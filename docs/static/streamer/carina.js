var carina = (function (exports) {
'use strict';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = Object.setPrototypeOf ||
    ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
    function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

var __assign = Object.assign || function __assign(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
    }
    return t;
};

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}
// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active && !(this instanceof domain.Domain)) {
      this.domain = domain.active;
    }
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var needDomainExit = false;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  if (needDomainExit)
    domain.exit();

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

var CarinaError = /** @class */ (function (_super) {
    __extends(CarinaError, _super);
    function CarinaError(message) {
        var _this = _super.call(this) || this;
        _this.message = message;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(_this, _this.constructor);
            return _this;
        }
        _this.stack = new Error().stack;
        return _this;
    }
    CarinaError.setProto = function (error) {
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(error, this.prototype);
            return;
        }
        error.__proto__ = this.prototype; // Super emergency fallback
    };
    return CarinaError;
}(Error));
var CancelledError = /** @class */ (function (_super) {
    __extends(CancelledError, _super);
    function CancelledError() {
        var _this = _super.call(this, 'Packet was cancelled or Carina was closed before a reply was received.') || this;
        CancelledError.setProto(_this);
        return _this;
    }
    return CancelledError;
}(CarinaError));
var EventTimeoutError = /** @class */ (function (_super) {
    __extends(EventTimeoutError, _super);
    function EventTimeoutError(eventName) {
        var _this = _super.call(this, "Timeout out waiting for event " + eventName) || this;
        _this.eventName = eventName;
        EventTimeoutError.setProto(_this);
        return _this;
    }
    return EventTimeoutError;
}(CarinaError));
var MessageParseError = /** @class */ (function (_super) {
    __extends(MessageParseError, _super);
    function MessageParseError(msg) {
        var _this = _super.call(this, msg) || this;
        MessageParseError.setProto(_this);
        return _this;
    }
    return MessageParseError;
}(CarinaError));

(function (ConstellationError_1) {
    var ConstellationError = /** @class */ (function (_super) {
        __extends(ConstellationError, _super);
        function ConstellationError(code, message) {
            var _this = _super.call(this, message) || this;
            _this.code = code;
            ConstellationError.setProto(_this);
            return _this;
        }
        ConstellationError.prototype.shouldReconnect = function () {
            return true;
        };
        return ConstellationError;
    }(CarinaError));
    ConstellationError_1.ConstellationError = ConstellationError;
    var errors = {};
    function from(_a) {
        var code = _a.code, message = _a.message;
        if (errors[code]) {
            return new errors[code](message);
        }
        return new ConstellationError(code, message);
    }
    ConstellationError_1.from = from;
    var InvalidPayload = /** @class */ (function (_super) {
        __extends(InvalidPayload, _super);
        function InvalidPayload(message) {
            var _this = _super.call(this, 4000, message) || this;
            InvalidPayload.setProto(_this);
            return _this;
        }
        return InvalidPayload;
    }(ConstellationError));
    ConstellationError_1.InvalidPayload = InvalidPayload;
    errors[4000] = InvalidPayload;
    var PayloadDecompression = /** @class */ (function (_super) {
        __extends(PayloadDecompression, _super);
        function PayloadDecompression(message) {
            var _this = _super.call(this, 4001, message) || this;
            PayloadDecompression.setProto(_this);
            return _this;
        }
        return PayloadDecompression;
    }(ConstellationError));
    ConstellationError_1.PayloadDecompression = PayloadDecompression;
    errors[4001] = PayloadDecompression;
    var UnknownPacketType = /** @class */ (function (_super) {
        __extends(UnknownPacketType, _super);
        function UnknownPacketType(message) {
            var _this = _super.call(this, 4002, message) || this;
            UnknownPacketType.setProto(_this);
            return _this;
        }
        return UnknownPacketType;
    }(ConstellationError));
    ConstellationError_1.UnknownPacketType = UnknownPacketType;
    errors[4002] = UnknownPacketType;
    var UnknownMethodName = /** @class */ (function (_super) {
        __extends(UnknownMethodName, _super);
        function UnknownMethodName(message) {
            var _this = _super.call(this, 4003, message) || this;
            UnknownMethodName.setProto(_this);
            return _this;
        }
        return UnknownMethodName;
    }(ConstellationError));
    ConstellationError_1.UnknownMethodName = UnknownMethodName;
    errors[4003] = UnknownMethodName;
    var InvalidMethodArguments = /** @class */ (function (_super) {
        __extends(InvalidMethodArguments, _super);
        function InvalidMethodArguments(message) {
            var _this = _super.call(this, 4004, message) || this;
            InvalidMethodArguments.setProto(_this);
            return _this;
        }
        return InvalidMethodArguments;
    }(ConstellationError));
    ConstellationError_1.InvalidMethodArguments = InvalidMethodArguments;
    errors[4004] = InvalidMethodArguments;
    var SessionExpired = /** @class */ (function (_super) {
        __extends(SessionExpired, _super);
        function SessionExpired(message) {
            var _this = _super.call(this, 4005, message) || this;
            SessionExpired.setProto(_this);
            return _this;
        }
        SessionExpired.prototype.shouldReconnect = function () {
            return false;
        };
        return SessionExpired;
    }(ConstellationError));
    ConstellationError_1.SessionExpired = SessionExpired;
    errors[4005] = SessionExpired;
    var LiveUnknownEvent = /** @class */ (function (_super) {
        __extends(LiveUnknownEvent, _super);
        function LiveUnknownEvent(message) {
            var _this = _super.call(this, 4106, message) || this;
            ConstellationError.setProto(_this);
            return _this;
        }
        return LiveUnknownEvent;
    }(ConstellationError));
    ConstellationError_1.LiveUnknownEvent = LiveUnknownEvent;
    errors[4106] = LiveUnknownEvent;
    var LiveAccessDenied = /** @class */ (function (_super) {
        __extends(LiveAccessDenied, _super);
        function LiveAccessDenied(message) {
            var _this = _super.call(this, 4107, message) || this;
            LiveAccessDenied.setProto(_this);
            return _this;
        }
        return LiveAccessDenied;
    }(ConstellationError));
    ConstellationError_1.LiveAccessDenied = LiveAccessDenied;
    errors[4107] = LiveAccessDenied;
    var LiveAlreadySubscribed = /** @class */ (function (_super) {
        __extends(LiveAlreadySubscribed, _super);
        function LiveAlreadySubscribed(message) {
            var _this = _super.call(this, 4108, message) || this;
            LiveAlreadySubscribed.setProto(_this);
            return _this;
        }
        return LiveAlreadySubscribed;
    }(ConstellationError));
    ConstellationError_1.LiveAlreadySubscribed = LiveAlreadySubscribed;
    errors[4108] = LiveAlreadySubscribed;
    var LiveNotSubscribed = /** @class */ (function (_super) {
        __extends(LiveNotSubscribed, _super);
        function LiveNotSubscribed(message) {
            var _this = _super.call(this, 4109, message) || this;
            LiveNotSubscribed.setProto(_this);
            return _this;
        }
        return LiveNotSubscribed;
    }(ConstellationError));
    ConstellationError_1.LiveNotSubscribed = LiveNotSubscribed;
    errors[4109] = LiveNotSubscribed;
})(exports.ConstellationError || (exports.ConstellationError = {}));

/**
 * The ExponentialReconnectionPolicy is a policy which reconnects the socket
 * on a delay specified by the equation min(maxDelay, attempts^2 * baseDelay).
 */
var ExponentialReconnectionPolicy = /** @class */ (function () {
    /**
     * @param {Number} maxDelay maximum duration to wait between reconnection attempts
     * @param {Number} baseDelay delay, in milliseconds, to use in
     */
    function ExponentialReconnectionPolicy(maxDelay, baseDelay) {
        if (maxDelay === void 0) { maxDelay = 20 * 1000; }
        if (baseDelay === void 0) { baseDelay = 500; }
        this.maxDelay = maxDelay;
        this.baseDelay = baseDelay;
        this.retries = 0;
    }
    ExponentialReconnectionPolicy.prototype.next = function () {
        return Math.min(this.maxDelay, (1 << (this.retries++)) * this.baseDelay);
    };
    ExponentialReconnectionPolicy.prototype.reset = function () {
        this.retries = 0;
    };
    return ExponentialReconnectionPolicy;
}());

var PacketState;
(function (PacketState) {
    // The packet has not been sent yet, it may be queued for later sending
    PacketState[PacketState["Pending"] = 1] = "Pending";
    // The packet has been sent over the websocket successfully and we are
    // waiting for a reply.
    PacketState[PacketState["Sending"] = 2] = "Sending";
    // The packet was replied to, and has now been complete.
    PacketState[PacketState["Replied"] = 3] = "Replied";
})(PacketState || (PacketState = {}));
/**
 * A Packet is a data type that can be sent over the wire to Constellation.
 */
var Packet = /** @class */ (function (_super) {
    __extends(Packet, _super);
    function Packet(method, params) {
        var _this = _super.call(this) || this;
        _this.state = PacketState.Pending;
        _this.data = {
            id: Packet.packetIncr++,
            type: 'method',
            method: method,
            params: params,
        };
        return _this;
    }
    /**
     * Returns the randomly-assigned numeric ID of the packet.
     * @return {number}
     */
    Packet.prototype.id = function () {
        return this.data.id;
    };
    /**
     * toJSON implements is called in JSON.stringify.
     */
    Packet.prototype.toJSON = function () {
        return this.data;
    };
    /**
     * Sets the timeout duration on the packet. It defaults to the socket's
     * timeout duration.
     */
    Packet.prototype.setTimeout = function (duration) {
        this.timeout = duration;
    };
    /**
     * Returns the packet's timeout duration, or the default if undefined.
     */
    Packet.prototype.getTimeout = function (defaultTimeout) {
        return this.timeout || defaultTimeout;
    };
    /**
     * Returns the current state of the packet.
     * @return {PacketState}
     */
    Packet.prototype.getState = function () {
        return this.state;
    };
    /**
     * Updates the state of the packet.
     * @param {PacketState} state
     */
    Packet.prototype.setState = function (state) {
        if (state === this.state) {
            return;
        }
        this.state = state;
    };
    Packet.packetIncr = 0;
    return Packet;
}(EventEmitter));
/**
 * Call represents a Constellation method call.
 */
var Call = /** @class */ (function (_super) {
    __extends(Call, _super);
    function Call() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Call;
}(Packet));

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};
function stringifyPrimitive(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
}

function stringify (obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
}

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

/**
 * Returns a promise that's resolved when an event is emitted on the
 * EventEmitter.
 */
function resolveOn(emitter, event, timeout) {
    if (timeout === void 0) { timeout = 120 * 1000; }
    return new Promise(function (resolve, reject) {
        var timer;
        var listener = function (data) {
            clearTimeout(timer);
            resolve(data);
        };
        emitter.once(event, listener);
        timer = setTimeout(function () {
            emitter.removeListener(event, listener);
            reject(new EventTimeoutError(event));
        }, timeout);
    });
}

// DO NOT EDIT, THIS IS UPDATE BY THE BUILD SCRIPT
var packageVersion = '0.11.0'; // package version
/**
 * SizeThresholdGzipDetector is a GzipDetector which zips all packets longer
 * than a certain number of bytes.
 */
var SizeThresholdGzipDetector = /** @class */ (function () {
    function SizeThresholdGzipDetector(threshold) {
        this.threshold = threshold;
    }
    SizeThresholdGzipDetector.prototype.shouldZip = function (packet) {
        return packet.length > this.threshold;
    };
    return SizeThresholdGzipDetector;
}());
/**
 * GzipTransform zips incoming and outgoing messages.
 */
var GzipTransform = /** @class */ (function () {
    function GzipTransform(detector) {
        this.detector = detector;
    }
    GzipTransform.prototype.outgoing = function (data, raw) {
        if (this.detector.shouldZip(data, raw)) {
            return undefined(data);
        }
        return data;
    };
    GzipTransform.prototype.incoming = function (data) {
        if (typeof data !== 'string') {
            return undefined(data, { to: 'string' });
        }
        return data;
    };
    return GzipTransform;
}());
/**
 * State is used to record the status of the websocket connection.
 */

(function (State) {
    // a connection attempt has not been made yet
    State[State["Idle"] = 1] = "Idle";
    // a connection attempt is currently being made
    State[State["Connecting"] = 2] = "Connecting";
    // the socket is connection and data may be sent
    State[State["Connected"] = 3] = "Connected";
    // the socket is gracefully closing; after this it will become Idle
    State[State["Closing"] = 4] = "Closing";
    // the socket is reconnecting after closing unexpectedly
    State[State["Reconnecting"] = 5] = "Reconnecting";
    // connect was called whilst the old socket was still open
    State[State["Refreshing"] = 6] = "Refreshing";
})(exports.State || (exports.State = {}));
function getDefaults() {
    return {
        url: 'wss://constellation.mixer.com',
        userAgent: "Carina " + packageVersion,
        replyTimeout: 10000,
        isBot: false,
        autoReconnect: true,
        reconnectionPolicy: new ExponentialReconnectionPolicy(),
        pingInterval: 10 * 1000,
    };
}
var jwtValidator = /^[\w_-]+?\.[\w_-]+?\.([\w_-]+)?$/i;
/**
 * The ConstellationSocket provides a somewhat low-level RPC framework for
 * interacting with Constellation over a websocket. It also provides
 * reconnection logic.
 */
var ConstellationSocket = /** @class */ (function (_super) {
    __extends(ConstellationSocket, _super);
    function ConstellationSocket(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        _this.state = exports.State.Idle;
        _this.setOptions(options);
        if (ConstellationSocket.WebSocket === undefined) {
            throw new Error('Cannot find a websocket implementation; please provide one by ' +
                'running ConstellationSocket.WebSocket = myWebSocketModule;');
        }
        _this.on('message', function (msg) { return _this.extractMessage(msg.data); });
        _this.on('open', function () { return _this.schedulePing(); });
        _this.on('event:hello', function () {
            _this.options.reconnectionPolicy.reset();
            _this.setState(exports.State.Connected);
        });
        _this.on('close', function (err) { return _this.handleSocketClose(err); });
        return _this;
    }
    /**
     * Set the given options.
     * Defaults and previous option values will be used if not supplied.
     */
    ConstellationSocket.prototype.setOptions = function (options) {
        this.options = __assign({}, getDefaults(), { transform: new GzipTransform(options.gzip || new SizeThresholdGzipDetector(1024)) }, this.options, options);
        if (this.options.jwt && !jwtValidator.test(this.options.jwt)) {
            throw new Error('Invalid jwt');
        }
        if (this.options.jwt && this.options.authToken) {
            throw new Error('Cannot connect to Constellation with both JWT and OAuth token.');
        }
    };
    /**
     * Open a new socket connection. By default, the socket will auto
     * connect when creating a new instance.
     */
    ConstellationSocket.prototype.connect = function () {
        var _this = this;
        var options = this.options;
        if (this.state === exports.State.Closing) {
            this.setState(exports.State.Refreshing);
            return this;
        }
        var protocol = options.gzip ? 'cnstl-gzip' : 'cnstl';
        var extras = {
            headers: {
                'User-Agent': options.userAgent,
                'X-Is-Bot': options.isBot,
            },
        };
        var url = options.url, queryString = options.queryString;
        if (options.authToken) {
            extras.headers['Authorization'] = "Bearer " + options.authToken;
        }
        else if (options.jwt) {
            queryString = __assign({}, queryString, { jwt: options.jwt });
        }
        url += "?" + stringify(queryString);
        var socket = new ConstellationSocket.WebSocket(url, protocol, extras);
        this.socket = socket;
        this.socket.binaryType = 'arraybuffer';
        this.setState(exports.State.Connecting);
        this.rebroadcastEvent('open');
        this.rebroadcastEvent('close');
        this.rebroadcastEvent('message');
        this.socket.addEventListener('error', function (err) {
            if (_this.state === exports.State.Closing) {
                // Ignore errors on a closing socket.
                return;
            }
            _this.emit('error', err);
        });
        return this;
    };
    /**
     * Returns the current state of the socket.
     * @return {State}
     */
    ConstellationSocket.prototype.getState = function () {
        return this.state;
    };
    /**
     * Close gracefully shuts down the websocket.
     */
    ConstellationSocket.prototype.close = function () {
        if (this.state === exports.State.Reconnecting) {
            clearTimeout(this.reconnectTimeout);
            this.setState(exports.State.Idle);
            return;
        }
        if (this.state !== exports.State.Idle) {
            this.setState(exports.State.Closing);
            this.socket.close();
            clearTimeout(this.pingTimeout);
        }
    };
    /**
     * Executes an RPC method on the server. Returns a promise which resolves
     * after it completes, or after a timeout occurs.
     */
    ConstellationSocket.prototype.execute = function (method, params) {
        if (params === void 0) { params = {}; }
        return this.send(new Packet(method, params));
    };
    /**
     * Send emits a packet over the websocket.
     */
    ConstellationSocket.prototype.send = function (packet) {
        var timeout = packet.getTimeout(this.options.replyTimeout);
        var promise = Promise.race([
            // Wait for replies to that packet ID:
            resolveOn(this, "reply:" + packet.id(), timeout)
                .then(function (result) {
                if (result.err) {
                    throw result.err;
                }
                return result.result;
            }),
            // Reject the packet if the socket closes before we get a reply:
            resolveOn(this, 'close', timeout + 1)
                .then(function () { throw new CancelledError(); }),
        ]);
        packet.emit('send', promise);
        packet.setState(PacketState.Sending);
        this.sendPacketInner(packet);
        return promise;
    };
    ConstellationSocket.prototype.setState = function (state) {
        if (this.state === state) {
            return;
        }
        this.state = state;
        this.emit('state', state);
    };
    ConstellationSocket.prototype.sendPacketInner = function (packet) {
        var data = JSON.stringify(packet);
        var payload = this.options.transform.outgoing(data, packet.toJSON());
        this.emit('send', payload);
        this.socket.send(payload);
    };
    ConstellationSocket.prototype.extractMessage = function (packet) {
        var message;
        try {
            message = JSON.parse(this.options.transform.incoming(packet));
        }
        catch (err) {
            throw new MessageParseError("Message returned was not valid JSON: " + err.stack);
        }
        // Bump the ping timeout whenever we get a message reply.
        this.schedulePing();
        switch (message.type) {
            case 'event':
                this.emit("event:" + message.event, message.data);
                break;
            case 'reply':
                var err = message.error ? exports.ConstellationError.from(message.error) : null;
                this.emit("reply:" + message.id, { err: err, result: message.result });
                break;
            default:
                throw new MessageParseError("Unknown message type \"" + message.type + "\"");
        }
    };
    ConstellationSocket.prototype.rebroadcastEvent = function (name) {
        var _this = this;
        this.socket.addEventListener(name, function (evt) { return _this.emit(name, evt); });
    };
    ConstellationSocket.prototype.schedulePing = function () {
        var _this = this;
        clearTimeout(this.pingTimeout);
        this.pingTimeout = setTimeout(function () {
            if (_this.state !== exports.State.Connected) {
                return;
            }
            var packet = new Packet('ping', null);
            var timeout = _this.options.replyTimeout;
            setTimeout(function () {
                _this.sendPacketInner(packet);
                _this.emit('ping');
            });
            Promise.race([
                resolveOn(_this, "reply:" + packet.id(), timeout),
                resolveOn(_this, 'close', timeout + 1),
            ])
                .then(function () { return _this.emit('pong'); })
                .catch(function (err) {
                _this.socket.close();
                _this.emit('warning', err);
            });
        }, this.options.pingInterval);
    };
    ConstellationSocket.prototype.handleSocketClose = function (cause) {
        var _this = this;
        var _a = this.options, autoReconnect = _a.autoReconnect, reconnectionPolicy = _a.reconnectionPolicy;
        if (this.state === exports.State.Refreshing) {
            this.setState(exports.State.Idle);
            this.connect();
            return;
        }
        if (this.state === exports.State.Closing || !autoReconnect) {
            this.setState(exports.State.Idle);
            return;
        }
        var err = exports.ConstellationError.from({ code: cause.code, message: cause.reason });
        if (!err.shouldReconnect()) {
            this.setState(exports.State.Idle);
            this.emit('error', err);
            return;
        }
        this.setState(exports.State.Reconnecting);
        this.reconnectTimeout = setTimeout(function () { return _this.connect(); }, reconnectionPolicy.next());
    };
    // WebSocket constructor, may be overridden if the environment
    // does not natively support it.
    ConstellationSocket.WebSocket = typeof WebSocket === 'undefined' ? null : WebSocket;
    return ConstellationSocket;
}(EventEmitter));

/**
 * Subscription is attached to a socket and tracks listening functions.
 */
var Subscription = /** @class */ (function () {
    function Subscription(socket, slug, onError) {
        this.socket = socket;
        this.slug = slug;
        this.onError = onError;
        this.listeners = [];
    }
    /**
     * add inserts the listener into the subscription
     */
    Subscription.prototype.add = function (listener) {
        if (this.listeners.length === 0) {
            this.addSocketListener();
        }
        this.listeners.push(listener);
    };
    /**
     * remove removes the listening function.
     */
    Subscription.prototype.remove = function (listener) {
        this.listeners = this.listeners.filter(function (l) { return l !== listener; });
        if (this.listeners.length === 0) {
            this.removeSocketListener();
        }
    };
    /**
     * removeAll destroys all listening functions and unsubscribes from the socket.
     */
    Subscription.prototype.removeAll = function () {
        this.listeners = [];
        this.removeSocketListener();
    };
    /**
     * Returns the number of listening functions attached to the subscription.
     */
    Subscription.prototype.listenerCount = function () {
        return this.listeners.length;
    };
    Subscription.prototype.addSocketListener = function () {
        var _this = this;
        this.socketStateListener = function (state) {
            if (state === exports.State.Connected) {
                _this.socket
                    .execute('livesubscribe', { events: [_this.slug] })
                    .catch(function (err) {
                    if (!(err instanceof CancelledError)) {
                        _this.onError(err);
                    }
                });
            }
        };
        this.socketDataListener = function (ev) {
            if (ev.channel === _this.slug) {
                _this.listeners.forEach(function (l) { return l(ev.payload); });
            }
        };
        this.socket.on('state', this.socketStateListener);
        this.socket.on('event:live', this.socketDataListener);
        this.socketStateListener(this.socket.getState());
    };
    Subscription.prototype.removeSocketListener = function () {
        if (!this.socketStateListener) {
            return;
        }
        if (this.socket.getState() === exports.State.Connected) {
            this.socket
                .execute('liveunsubscribe', { events: [this.slug] })
                .catch(function () { return undefined; }); // don't care about anything here
        }
        this.socket.removeListener('state', this.socketStateListener);
        this.socket.removeListener('event:live', this.socketDataListener);
        this.socketStateListener = undefined;
        this.socketDataListener = undefined;
    };
    return Subscription;
}());

var Carina = /** @class */ (function (_super) {
    __extends(Carina, _super);
    function Carina(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        _this.subscriptions = Object.create(null);
        _this.socket = new ConstellationSocket(options);
        _this.socket.on('error', function (err) { return _this.emit('error', err); });
        return _this;
    }
    Object.defineProperty(Carina, "WebSocket", {
        get: function () {
            return ConstellationSocket.WebSocket;
        },
        /**
         * Set the websocket implementation.
         * You will likely not need to set this in a browser environment.
         * You will not need to set this if WebSocket is globally available.
         *
         * @example
         * Carina.WebSocket = require('ws');
         */
        set: function (ws) {
            ConstellationSocket.WebSocket = ws;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Sets the given options on the socket.
     */
    Carina.prototype.setOptions = function (options) {
        this.socket.setOptions(options);
    };
    /**
     * Boots the connection to constellation.
     */
    Carina.prototype.open = function () {
        this.socket.connect();
        return this;
    };
    /**
     * Frees resources associated with the Constellation connection.
     */
    Carina.prototype.close = function () {
        this.socket.close();
    };
    /**
     * @callback onSubscriptionCb
     * @param {Object} data - The payload for the update.
     */
    /**
     * Subscribe to a live event
     *
     * @param {string} slug
     * @param {onSubscriptionCb} cb - Called each time we receive an event for this slug.
     * @returns {Promise.<>} Resolves once subscribed. Any errors will reject.
     */
    Carina.prototype.subscribe = function (slug, cb) {
        var _this = this;
        var subscription = this.subscriptions[slug];
        if (!subscription) {
            subscription = this.subscriptions[slug]
                = new Subscription(this.socket, slug, function (err) { return _this.emit('error', err); });
        }
        subscription.add(cb);
        return Promise.resolve(); // backwards-compat
    };
    /**
     * Unsubscribe from a live event.
     *
     * @param {string} slug
     * @returns {Promise.<>} Resolves once unsubscribed. Any errors will reject.
     */
    Carina.prototype.unsubscribe = function (slug, listener) {
        var subscription = this.subscriptions[slug];
        if (!subscription) {
            return Promise.resolve();
        }
        if (listener) {
            subscription.remove(listener);
        }
        else {
            subscription.removeAll();
        }
        if (subscription.listenerCount() === 0) {
            delete this.subscriptions[slug];
        }
        return Promise.resolve(); // backwards-compat
    };
    return Carina;
}(EventEmitter));

exports.Carina = Carina;
exports.Subscription = Subscription;
exports.SocketState = exports.State;
exports.CarinaError = CarinaError;
exports.CancelledError = CancelledError;
exports.EventTimeoutError = EventTimeoutError;
exports.MessageParseError = MessageParseError;
exports.SizeThresholdGzipDetector = SizeThresholdGzipDetector;
exports.GzipTransform = GzipTransform;
exports.ConstellationSocket = ConstellationSocket;

return exports;

}({}));
