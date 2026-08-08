/* global require, __dirname */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('node:test');

function createDeferred() {
  let state = 'pending';
  let value;
  let failure;
  const handlers = [];

  const deferred = {
    resolve(v) {
      if (state !== 'pending') return this;
      state = 'resolved';
      value = v;
      handlers.forEach(({ type, fn }) => {
        if (type === 'done' || type === 'always') {
          fn(v);
        }
      });
      return this;
    },
    reject(v) {
      if (state !== 'pending') return this;
      state = 'rejected';
      failure = v;
      handlers.forEach(({ type, fn }) => {
        if (type === 'fail' || type === 'always') {
          fn(v);
        }
      });
      return this;
    },
    then(onFulfilled, onRejected) {
      const next = createDeferred();
      const settle = () => {
        try {
          const result = state === 'resolved'
            ? (onFulfilled ? onFulfilled(value) : value)
            : (onRejected ? onRejected(failure) : failure);
          if (result && typeof result.then === 'function') {
            result.then(v => next.resolve(v), e => next.reject(e));
          } else {
            next.resolve(result);
          }
        } catch (err) {
          next.reject(err);
        }
      };

      if (state === 'pending') {
        handlers.push({ type: 'always', fn: settle });
      } else {
        settle();
      }
      return next;
    },
    done(fn) {
      if (state === 'resolved') {
        fn(value);
      } else if (state === 'pending') {
        handlers.push({ type: 'done', fn });
      }
      return this;
    },
    fail(fn) {
      if (state === 'rejected') {
        fn(failure);
      } else if (state === 'pending') {
        handlers.push({ type: 'fail', fn });
      }
      return this;
    },
    always(fn) {
      if (state === 'resolved') {
        fn(value);
      } else if (state === 'rejected') {
        fn(failure);
      } else {
        handlers.push({ type: 'always', fn });
      }
      return this;
    },
    promise() {
      return this;
    }
  };

  return deferred;
}

function loadFirmwareModule() {
  const context = {
    OSApp: {
      currentSession: {
        pass: 'secret',
        token: null,
        ip: '192.168.0.10',
        prefix: 'http://',
        controller: {}
      },
      currentDevice: {},
      Firmware: {},
      Errors: { showError() {} },
      Language: { _: v => v },
      Constants: { http: { RETRY_COUNT: 0 } }
    },
    window: {},
    console,
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.window.cordova = undefined;
  context.$ = function() {};
  context.$.Deferred = createDeferred;
  context.$.ajaxq = function() {
    const deferred = createDeferred();
    deferred.resolve({ result: 2 });
    return deferred;
  };
  context.$.extend = function(target) {
    for (let i = 1; i < arguments.length; i++) {
      const source = arguments[i] || {};
      Object.keys(source).forEach(key => {
        target[key] = source[key];
      });
    }
    return target;
  };
  context.$.parseJSON = function(v) { return JSON.parse(v); };
  context.$.isEmptyObject = function(v) { return !v || Object.keys(v).length === 0; };
  context.$.inArray = function(item, arr) { return arr.indexOf(item); };

  const script = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'modules', 'firmware.js'), 'utf8');
  vm.runInNewContext(script, context, { filename: 'firmware.js' });
  return context;
}

test('sendToOS resolves completion callbacks for controller-level error responses', () => {
  const context = loadFirmwareModule();
  let completed = false;
  context.OSApp.Firmware.sendToOS('/cv?pw=&en=1').done(function() {
    completed = true;
  });

  assert.strictEqual(completed, true, 'done handler should still run when the controller returns an application-level error');
});
