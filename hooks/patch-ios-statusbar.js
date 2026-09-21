#!/usr/bin/env node

/**
 * Patches cordova-plugin-statusbar's CDVStatusBar.m for cordova-ios 8 after `cordova prepare`.
 *
 * The plugin (3.0.0 and 4.0.0 alike) reads the status bar height from
 * [UIApplication sharedApplication].statusBarFrame, deprecated since iOS 13. cordova-ios 8
 * runs the app through a UIScene lifecycle (SceneDelegate), where that property returns
 * CGRectZero on current iOS releases. StatusBar.overlaysWebView(false) then leaves the web
 * view at y = 0, and the app's header ends up underneath the status bar; the coloured
 * background view behind the status bar gets a zero height as well.
 *
 * The patch replaces the three reads (and the deprecated statusBarOrientation read next to
 * them) with helpers that ask the window scene's UIStatusBarManager. The plugin also relies on
 * UIApplicationDidChangeStatusBarFrameNotification to follow rotations; that notification is
 * not posted in scene-based apps either, so the patch re-applies the layout from cordova-ios'
 * CDVViewDidLayoutSubviewsNotification whenever the status bar height changes. It is idempotent
 * and touches both the platform copy that Xcode compiles and the plugins/ copy, so a later
 * re-install of the plugin into platforms/ starts from the patched source.
 * See https://github.com/apache/cordova-plugin-statusbar/issues/294.
 */

const fs = require("fs");
const path = require("path");

const MARKER = "CDVStatusBarFrameForViewController";

const HELPERS = `
// OpenSprinkler (hooks/patch-ios-statusbar.js): [UIApplication sharedApplication].statusBarFrame
// is deprecated since iOS 13 and returns CGRectZero in scene-based apps (cordova-ios 8).
// Ask the window scene's status bar manager instead.
static UIWindowScene *CDVStatusBarWindowSceneForViewController(UIViewController *viewController) API_AVAILABLE(ios(13.0))
{
    UIWindowScene *scene = viewController.view.window.windowScene;
    if (scene == nil) {
        for (UIScene *candidate in [UIApplication sharedApplication].connectedScenes) {
            if ([candidate isKindOfClass:[UIWindowScene class]]) {
                scene = (UIWindowScene *)candidate;
                break;
            }
        }
    }
    return scene;
}

static CGRect ${MARKER}(UIViewController *viewController)
{
    if (@available(iOS 13.0, *)) {
        UIWindowScene *scene = CDVStatusBarWindowSceneForViewController(viewController);
        if (scene != nil && scene.statusBarManager != nil) {
            return scene.statusBarManager.statusBarFrame;
        }
    }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    return [UIApplication sharedApplication].statusBarFrame;
#pragma clang diagnostic pop
}

static UIInterfaceOrientation CDVStatusBarInterfaceOrientationForViewController(UIViewController *viewController)
{
    if (@available(iOS 13.0, *)) {
        UIWindowScene *scene = CDVStatusBarWindowSceneForViewController(viewController);
        if (scene != nil) {
            return scene.interfaceOrientation;
        }
    }
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    return [UIApplication sharedApplication].statusBarOrientation;
#pragma clang diagnostic pop
}
`;

const LAYOUT_HANDLER = `// OpenSprinkler (hooks/patch-ios-statusbar.js): UIApplicationDidChangeStatusBarFrameNotification
// is not posted in scene-based apps. Re-apply the layout whenever the status bar height
// changes (rotation, in-call bar); cordova-ios posts this after every viewDidLayoutSubviews.
-(void)cdvViewDidLayoutSubviews:(NSNotification*)notification
{
    static CGFloat lastHeight = -1;
    CGFloat height = ${MARKER}(self.viewController).size.height;
    if (fabs(height - lastHeight) < 0.5) {
        return;
    }
    lastHeight = height;
    [self statusBarDidChangeFrame:notification];
}

`;

function patchSource(source) {
    if (source.indexOf(MARKER) !== -1) {
        return null; // already patched
    }

    const anchor = /#import <Cordova\/CDVViewController\.h>\r?\n/;
    if (!anchor.test(source)) {
        throw new Error("CDVViewController.h import not found; plugin layout changed");
    }

    const frameReads = source.match(/\[UIApplication sharedApplication\]\.statusBarFrame/g) || [];
    if (frameReads.length === 0) {
        throw new Error("no statusBarFrame reads found; nothing to patch");
    }

    // Replace the reads first: the helpers inserted afterwards keep the deprecated
    // call as their own fallback and must not be rewritten.
    let patched = source.replace(/\[UIApplication sharedApplication\]\.statusBarFrame/g,
        MARKER + "(self.viewController)");
    patched = patched.replace(/\[\[UIApplication sharedApplication\]\s*statusBarOrientation\]/g,
        "CDVStatusBarInterfaceOrientationForViewController(self.viewController)");
    patched = patched.replace(anchor, (m) => m + HELPERS);

    // Rotation / in-call bar: follow status bar height changes via cordova-ios' layout notification.
    const observerAnchor = /^(\s*)(\[\[NSNotificationCenter defaultCenter\] addObserver:self selector:@selector\(statusBarDidChangeFrame:\)[^\n]*\n)/m;
    const handlerAnchor = /^-\s*\(void\)\s*statusBarDidChangeFrame:\(NSNotification\*\)notification\s*\n/m;
    const deallocAnchor = /^(\s*)(\[\[NSNotificationCenter defaultCenter\]\s*removeObserver:self name:UIApplicationDidChangeStatusBarOrientationNotification[^\n]*\n)/m;
    if (!observerAnchor.test(patched) || !handlerAnchor.test(patched) || !deallocAnchor.test(patched)) {
        throw new Error("statusBarDidChangeFrame wiring not found; plugin layout changed");
    }
    patched = patched.replace(observerAnchor, (m, indent, line) => indent + line +
        indent + "[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(cdvViewDidLayoutSubviews:) name:@\"CDVViewDidLayoutSubviewsNotification\" object:nil];\n");
    patched = patched.replace(handlerAnchor, (m) => LAYOUT_HANDLER + m);
    patched = patched.replace(deallocAnchor, (m, indent, line) => indent + line +
        indent + "[[NSNotificationCenter defaultCenter] removeObserver:self name:@\"CDVViewDidLayoutSubviewsNotification\" object:nil];\n");
    return patched;
}

function patchFile(target) {
    if (!fs.existsSync(target)) {
        return "missing";
    }
    const source = fs.readFileSync(target, "utf8");
    const patched = patchSource(source);
    if (patched === null) {
        return "already patched";
    }
    fs.writeFileSync(target, patched);
    return "patched";
}

module.exports = function (context) {
    const projectRoot = (context && context.opts && context.opts.projectRoot) || process.cwd();

    // Only run when the iOS platform is present/being prepared.
    const platforms = (context && context.opts && context.opts.platforms) || [];
    if (platforms.length && !platforms.includes("ios")) {
        return;
    }

    const targets = [
        path.join(projectRoot, "platforms", "ios", "App", "Plugins", "cordova-plugin-statusbar", "CDVStatusBar.m"),
        path.join(projectRoot, "plugins", "cordova-plugin-statusbar", "src", "ios", "CDVStatusBar.m")
    ];

    targets.forEach((target) => {
        const result = patchFile(target);
        if (result === "patched") {
            console.log("✓ [patch-ios-statusbar] Patched " + path.relative(projectRoot, target));
        }
    });
};

module.exports.patchSource = patchSource;

if (require.main === module) {
    module.exports({ opts: { projectRoot: process.cwd(), platforms: ["ios"] } });
}
