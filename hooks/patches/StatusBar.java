/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

/*
 * OpenSprinkler modification: Android 15 (targetSdk 35+) enforces edge-to-edge and
 * deprecates Window.setStatusBarColor()/View.setSystemUiVisibility(). Google Play flags
 * those calls ("edge-to-edge display uses deprecated APIs"). This drop-in replacement keeps
 * the exact same JavaScript-facing action interface but implements it with the non-deprecated
 * AndroidX WindowCompat / WindowInsetsControllerCompat APIs and applies system-bar insets as
 * content padding so nothing is hidden behind the status/navigation bars.
 * Installed after `cordova prepare` by hooks/patch-android-statusbar.js.
*/
package org.apache.cordova.statusbar;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaArgs;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.LOG;
import org.apache.cordova.PluginResult;
import org.json.JSONException;

public class StatusBar extends CordovaPlugin {
    private static final String TAG = "StatusBar";

    // When true the WebView draws edge-to-edge behind the status bar (no top inset padding).
    // When false, system-bar insets are applied as padding so content stays clear of the bars.
    private boolean overlays = true;
    private boolean statusBarVisible = true;
    private int statusBarBackground = Color.BLACK;

    @Override
    public void initialize(final CordovaInterface cordova, CordovaWebView webView) {
        LOG.v(TAG, "StatusBar: initialization");
        super.initialize(cordova, webView);

        this.cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Window window = cordova.getActivity().getWindow();
                window.clearFlags(WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);

                // Enable edge-to-edge with the modern API instead of setStatusBarColor()/setSystemUiVisibility().
                WindowCompat.setDecorFitsSystemWindows(window, false);

                // Theme.Holo.Light has a white window background that would otherwise show through
                // behind the edge-to-edge WebView and the transparent jQuery Mobile toolbars.
                window.getDecorView().setBackgroundColor(Color.BLACK);

                installInsetsListener();

                overlays = preferences.getBoolean("StatusBarOverlaysWebView", true);
                setStatusBarBackgroundColor(preferences.getString("StatusBarBackgroundColor", "#000000"));

                String styleSetting = preferences.getString("StatusBarStyle", "lightcontent");
                if (styleSetting.equalsIgnoreCase("blacktranslucent") || styleSetting.equalsIgnoreCase("blackopaque")) {
                    LOG.w(TAG, styleSetting + " is deprecated and will be removed in next major release, use lightcontent");
                }
                setStatusBarStyle(styleSetting);

                requestInsets();
            }
        });
    }

    @Override
    public boolean execute(final String action, final CordovaArgs args, final CallbackContext callbackContext) throws JSONException {
        LOG.v(TAG, "Executing action: " + action);
        final Activity activity = this.cordova.getActivity();
        final Window window = activity.getWindow();

        if ("_ready".equals(action)) {
            callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, statusBarVisible));
            return true;
        }

        if ("show".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    statusBarVisible = true;
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                    if (controller != null) {
                        controller.show(WindowInsetsCompat.Type.statusBars());
                    }
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    requestInsets();
                }
            });
            return true;
        }

        if ("hide".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    statusBarVisible = false;
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                    if (controller != null) {
                        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        controller.hide(WindowInsetsCompat.Type.statusBars());
                    }
                    requestInsets();
                }
            });
            return true;
        }

        if ("backgroundColorByHexString".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        setStatusBarBackgroundColor(args.getString(0));
                    } catch (JSONException ignore) {
                        LOG.e(TAG, "Invalid hexString argument, use f.i. '#777777'");
                    }
                }
            });
            return true;
        }

        if ("overlaysWebView".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        overlays = args.getBoolean(0);
                        requestInsets();
                    } catch (JSONException ignore) {
                        LOG.e(TAG, "Invalid boolean argument");
                    }
                }
            });
            return true;
        }

        if ("styleDefault".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setStatusBarStyle("default");
                }
            });
            return true;
        }

        if ("styleLightContent".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setStatusBarStyle("lightcontent");
                }
            });
            return true;
        }

        if ("styleBlackTranslucent".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setStatusBarStyle("blacktranslucent");
                }
            });
            return true;
        }

        if ("styleBlackOpaque".equals(action)) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    setStatusBarStyle("blackopaque");
                }
            });
            return true;
        }

        return false;
    }

    private View getContentView() {
        return cordova.getActivity().findViewById(android.R.id.content);
    }

    // Applies system-bar (and display-cutout) insets as content padding using the modern
    // AndroidX inset API. Replaces the deprecated SYSTEM_UI_FLAG_LAYOUT_* flags.
    private void installInsetsListener() {
        final View content = getContentView();
        if (content == null) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            if (overlays) {
                v.setPadding(0, 0, 0, 0);
                // Edge-to-edge behind the bars: leave insets unconsumed so the WebView can
                // handle them via CSS env(safe-area-inset-*).
                return windowInsets;
            }
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            // Consume the insets so the child WebView does NOT apply them again. On Android 15+
            // (API 35+) edge-to-edge is enforced and Chromium otherwise adds its own system-bar
            // insets on top of this padding, producing doubled top/bottom margins. We have
            // already accounted for them here. (No-op on older versions that didn't double.)
            return WindowInsetsCompat.CONSUMED;
        });
    }

    private void requestInsets() {
        View content = getContentView();
        if (content != null) {
            ViewCompat.requestApplyInsets(content);
        }
    }

    // On Android 15 setStatusBarColor() is deprecated/ignored, so we tint the status-bar
    // strip by colouring the padded content view instead.
    private void setStatusBarBackgroundColor(final String colorPref) {
        if (colorPref == null || colorPref.isEmpty()) {
            return;
        }
        try {
            statusBarBackground = Color.parseColor(colorPref);
        } catch (IllegalArgumentException ignore) {
            LOG.e(TAG, "Invalid hexString argument, use f.i. '#999999'");
            return;
        }
        View content = getContentView();
        if (content != null) {
            content.setBackgroundColor(statusBarBackground);
        }
    }

    private void setStatusBarStyle(final String style) {
        if (style == null || style.isEmpty()) {
            return;
        }
        final Window window = cordova.getActivity().getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller == null) {
            return;
        }
        String lower = style.toLowerCase();
        // "default" => dark icons for a light bar. "lightcontent"/black* => light icons.
        if (lower.equals("default")) {
            controller.setAppearanceLightStatusBars(true);
        } else if (lower.equals("lightcontent") || lower.equals("blacktranslucent") || lower.equals("blackopaque")) {
            controller.setAppearanceLightStatusBars(false);
        } else {
            LOG.e(TAG, "Invalid style, must be either 'default', 'lightcontent' or the deprecated 'blacktranslucent' and 'blackopaque'");
        }
    }
}
