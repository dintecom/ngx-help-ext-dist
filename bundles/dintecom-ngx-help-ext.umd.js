(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/common/http'), require('@angular/core'), require('@angular/platform-browser'), require('rxjs'), require('rxjs/operators'), require('@angular/cdk/overlay'), require('@angular/cdk/platform'), require('@angular/cdk/portal'), require('@angular/common'), require('@angular/router'), require('@angular/animations'), require('@angular/cdk/coercion')) :
    typeof define === 'function' && define.amd ? define('@dintecom/ngx-help-ext', ['exports', '@angular/common/http', '@angular/core', '@angular/platform-browser', 'rxjs', 'rxjs/operators', '@angular/cdk/overlay', '@angular/cdk/platform', '@angular/cdk/portal', '@angular/common', '@angular/router', '@angular/animations', '@angular/cdk/coercion'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.dintecom = global.dintecom || {}, global.dintecom['ngx-help-ext'] = {}), global.ng.common.http, global.ng.core, global.ng.platformBrowser, global.rxjs, global.rxjs.operators, global.ng.cdk.overlay, global.ng.cdk.platform, global.ng.cdk.portal, global.ng.common, global.ng.router, global.ng.animations, global.ng.cdk.coercion));
}(this, (function (exports, http, core, platformBrowser, rxjs, operators, overlay, platform, portal, common, router, animations, coercion) { 'use strict';

    var Article = /** @class */ (function () {
        function Article() {
        }
        return Article;
    }());

    var Attachment = /** @class */ (function () {
        function Attachment() {
        }
        return Attachment;
    }());

    var HelpExtUrlResolver = /** @class */ (function () {
        function HelpExtUrlResolver() {
        }
        return HelpExtUrlResolver;
    }());
    var HELP_EXT_URL_TOKEN = new core.InjectionToken('HELP_EXT_URL');
    var HELP_EXT_CACHE_LIFETIME_TOKEN = new core.InjectionToken('HELP_EXT_CACHE_LIFETIME');
    var HELP_EXT_HTTP_HEADERS = new core.InjectionToken('HELP_EXT_HTTP_HEADERS');

    var cacheLifetimeSecondDefault = 30 * 60;
    var HelpExtService = /** @class */ (function () {
        function HelpExtService(helpExtUrlResolver, _http, _sanitizer, helpExtUrl, cacheLifetimeSecond, _httpHeaders) {
            this._http = _http;
            this._sanitizer = _sanitizer;
            this._httpHeaders = _httpHeaders;
            this.cacheById = {};
            this.requestCacheById = {};
            this.cacheByUid = {};
            this.requestCacheByUid = {};
            this.cacheByUrl = {};
            this.requestCacheByUrl = {};
            if (helpExtUrlResolver) {
                var resolved = helpExtUrlResolver.resolve();
                if (typeof resolved === 'string') {
                    this.baseAddress = rxjs.of(resolved).pipe(operators.shareReplay(1));
                }
                else if (rxjs.isObservable(resolved)) {
                    this.baseAddress = resolved.pipe(operators.shareReplay(1));
                }
                else {
                    throw Error('Not supported helpExtUrlResolver');
                }
            }
            else if (helpExtUrl) {
                this.baseAddress = rxjs.of(helpExtUrl).pipe(operators.shareReplay(1));
            }
            else {
                throw Error('Please, configure helpExtUrl or helpExtUrlResolver');
            }
            this.cacheLifetime = cacheLifetimeSecond * 1000;
        }
        HelpExtService.prototype.getArticleById = function (id) {
            var _this = this;
            return this.baseAddress.pipe(operators.mergeMap(function (baseAddress) { return _this.cachedGet(_this.cacheById, _this.requestCacheById, id, baseAddress + "/api/Clients/GetArticleById/" + id); }));
        };
        HelpExtService.prototype.getArticleByUid = function (siteOrigin, uid) {
            var _this = this;
            return this.baseAddress.pipe(operators.mergeMap(function (baseAddress) { return _this.cachedGet(_this.cacheByUid, _this.requestCacheByUid, uid, baseAddress + "/api/Clients/GetArticleByUid?siteOrigin=" + encodeURIComponent(siteOrigin) + "&uid=" + encodeURIComponent(uid)); }));
        };
        HelpExtService.prototype.getArticleByUrl = function (url) {
            var _this = this;
            return this.baseAddress.pipe(operators.mergeMap(function (baseAddress) { return _this.cachedGet(_this.cacheByUrl, _this.requestCacheByUrl, url, baseAddress + "/api/Clients/GetArticleByUrl?url=" + encodeURIComponent(url)); }));
        };
        HelpExtService.prototype.sanitizeContent = function (content) {
            return this._sanitizer.sanitize(core.SecurityContext.HTML, this._sanitizer.bypassSecurityTrustHtml(content));
        };
        HelpExtService.prototype.makeAbsoluteLinks = function (element, baseAddress, linkTarget) {
            var el = element instanceof core.ElementRef ? element.nativeElement : element;
            var links = el.getElementsByTagName('a');
            for (var i = 0; i < links.length; i++) {
                if (linkTarget) {
                    links[i].setAttribute('target', linkTarget);
                }
                var href = links[i].getAttribute('href');
                if (/(?:^[a-z][a-z0-9+.-]*:|\/\/)/.test(href))
                    continue;
                href = baseAddress + "/" + href;
                links[i].setAttribute('href', href);
            }
        };
        HelpExtService.prototype.cachedGet = function (cache, requestCache, key, httpUrl) {
            var _this = this;
            if (cache[key]) {
                return cache[key].error ? rxjs.throwError(cache[key].error) : rxjs.of(cache[key].article);
            }
            if (requestCache[key])
                return requestCache[key];
            var request = {};
            if (this._httpHeaders) {
                request.headers = this._httpHeaders;
            }
            requestCache[key] = this._http.get(httpUrl, request).pipe(operators.map(function (a) { return a; }), operators.tap(function (a) {
                delete requestCache[key];
                cache[key] = {
                    article: a,
                };
            }), operators.catchError(function (e) {
                delete requestCache[key];
                cache[key] = {
                    error: e,
                };
                return rxjs.throwError(e);
            }), operators.finalize(function () {
                setTimeout(function () { return delete cache[key]; }, _this.cacheLifetime);
            }), operators.share());
            return requestCache[key];
        };
        return HelpExtService;
    }());
    HelpExtService.decorators = [
        { type: core.Injectable }
    ];
    HelpExtService.ctorParameters = function () { return [
        { type: HelpExtUrlResolver },
        { type: http.HttpClient },
        { type: platformBrowser.DomSanitizer },
        { type: String, decorators: [{ type: core.Inject, args: [HELP_EXT_URL_TOKEN,] }] },
        { type: Number, decorators: [{ type: core.Inject, args: [HELP_EXT_CACHE_LIFETIME_TOKEN,] }] },
        { type: undefined, decorators: [{ type: core.Inject, args: [HELP_EXT_HTTP_HEADERS,] }] }
    ]; };

    var helpExtFlyoutAnimations = {
        flyoutState: animations.trigger('state', [
            animations.state('initial, void, hidden', animations.style({ opacity: 0 })),
            animations.transition('* => visible', animations.animate('200ms cubic-bezier(0, 0, 0.2, 1)', animations.style({ opacity: 1 }))),
            animations.transition('* => hidden', animations.animate('100ms cubic-bezier(0, 0, 0.2, 1)', animations.style({ opacity: 0 }))),
        ]),
    };

    var HelpExtFlyoutComponent = /** @class */ (function () {
        function HelpExtFlyoutComponent() {
            this.mouseEnter = new core.EventEmitter();
            this.mouseLeave = new core.EventEmitter();
            this.afterHidden = new core.EventEmitter();
            this._visibility = 'initial';
        }
        HelpExtFlyoutComponent.prototype._onMouseEnter = function () {
            this.mouseEnter.emit();
        };
        HelpExtFlyoutComponent.prototype._onMouseLeave = function () {
            this.mouseLeave.emit();
        };
        HelpExtFlyoutComponent.prototype._onStateDone = function (event) {
            var toState = event.toState;
            if (toState === 'hidden' && !this.isVisible()) {
                this.afterHidden.emit();
            }
        };
        HelpExtFlyoutComponent.prototype.show = function () {
            this._visibility = 'visible';
        };
        HelpExtFlyoutComponent.prototype.hide = function () {
            this._visibility = 'hidden';
        };
        HelpExtFlyoutComponent.prototype.isVisible = function () {
            return this._visibility === 'visible';
        };
        return HelpExtFlyoutComponent;
    }());
    HelpExtFlyoutComponent.decorators = [
        { type: core.Component, args: [{
                    selector: 'help-ext-flyout',
                    template: "<help-ext-article-content class=\"help-ext-flyout-content\" [content]=\"article?.content\"></help-ext-article-content>\n<div class=\"help-ext-flyout-attachments\" *ngIf=\"article?.attachments?.length\">\n  <h2 class=\"help-ext-flyout-attachments-title\">Attachments ({{article.attachments?.length}})</h2>\n  <help-ext-attachment *ngFor=\"let attachment of article.attachments\" [attachment]=\"attachment\"></help-ext-attachment>\n</div>\n",
                    animations: [helpExtFlyoutAnimations.flyoutState],
                    changeDetection: core.ChangeDetectionStrategy.OnPush,
                    host: {
                        class: 'help-ext-flyout',
                    }
                },] }
    ];
    HelpExtFlyoutComponent.propDecorators = {
        article: [{ type: core.Input }],
        mouseEnter: [{ type: core.Output }],
        mouseLeave: [{ type: core.Output }],
        afterHidden: [{ type: core.Output }],
        _onMouseEnter: [{ type: core.HostListener, args: ['mouseenter',] }],
        _onMouseLeave: [{ type: core.HostListener, args: ['mouseleave',] }],
        _visibility: [{ type: core.HostBinding, args: ['@state',] }],
        _onStateDone: [{ type: core.HostListener, args: ['@state.done', ['$event'],] }]
    };

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b)
                if (Object.prototype.hasOwnProperty.call(b, p))
                    d[p] = b[p]; };
        return extendStatics(d, b);
    };
    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }
    var __assign = function () {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s)
                    if (Object.prototype.hasOwnProperty.call(s, p))
                        t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    function __rest(s, e) {
        var t = {};
        for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
                t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
            r = Reflect.decorate(decorators, target, key, desc);
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if (d = decorators[i])
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }
    function __param(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); };
    }
    function __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
            return Reflect.metadata(metadataKey, metadataValue);
    }
    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try {
                step(generator.next(value));
            }
            catch (e) {
                reject(e);
            } }
            function rejected(value) { try {
                step(generator["throw"](value));
            }
            catch (e) {
                reject(e);
            } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }
    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function () { if (t[0] & 1)
                throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f)
                throw new TypeError("Generator is already executing.");
            while (_)
                try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                        return t;
                    if (y = 0, t)
                        op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                                _ = 0;
                                continue;
                            }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2])
                                _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                }
                catch (e) {
                    op = [6, e];
                    y = 0;
                }
                finally {
                    f = t = 0;
                }
            if (op[0] & 5)
                throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    }
    var __createBinding = Object.create ? (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
    }) : (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        o[k2] = m[k];
    });
    function __exportStar(m, o) {
        for (var p in m)
            if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
                __createBinding(o, m, p);
    }
    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m)
            return m.call(o);
        if (o && typeof o.length === "number")
            return {
                next: function () {
                    if (o && i >= o.length)
                        o = void 0;
                    return { value: o && o[i++], done: !o };
                }
            };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m)
            return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
                ar.push(r.value);
        }
        catch (error) {
            e = { error: error };
        }
        finally {
            try {
                if (r && !r.done && (m = i["return"]))
                    m.call(i);
            }
            finally {
                if (e)
                    throw e.error;
            }
        }
        return ar;
    }
    /** @deprecated */
    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }
    /** @deprecated */
    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    function __spreadArray(to, from) {
        for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
            to[j] = from[i];
        return to;
    }
    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }
    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n])
            i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try {
            step(g[n](v));
        }
        catch (e) {
            settle(q[0][3], e);
        } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length)
            resume(q[0][0], q[0][1]); }
    }
    function __asyncDelegator(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }
    function __asyncValues(o) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function (v) { resolve({ value: v, done: d }); }, reject); }
    }
    function __makeTemplateObject(cooked, raw) {
        if (Object.defineProperty) {
            Object.defineProperty(cooked, "raw", { value: raw });
        }
        else {
            cooked.raw = raw;
        }
        return cooked;
    }
    ;
    var __setModuleDefault = Object.create ? (function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function (o, v) {
        o["default"] = v;
    };
    function __importStar(mod) {
        if (mod && mod.__esModule)
            return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    }
    function __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }
    function __classPrivateFieldGet(receiver, state, kind, f) {
        if (kind === "a" && !f)
            throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
            throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    }
    function __classPrivateFieldSet(receiver, state, value, kind, f) {
        if (kind === "m")
            throw new TypeError("Private method is not writable");
        if (kind === "a" && !f)
            throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
            throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    }

    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    /**
     * Gets whether an element is scrolled outside of view by any of its parent scrolling containers.
     * @param element Dimensions of the element (from getBoundingClientRect)
     * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
     * @returns Whether the element is scrolled out of view
     * @docs-private
     */
    function isElementScrolledOutsideView(element, scrollContainers) {
        return scrollContainers.some(function (containerBounds) {
            var outsideAbove = element.bottom < containerBounds.top;
            var outsideBelow = element.top > containerBounds.bottom;
            var outsideLeft = element.right < containerBounds.left;
            var outsideRight = element.left > containerBounds.right;
            return outsideAbove || outsideBelow || outsideLeft || outsideRight;
        });
    }
    /**
     * Gets whether an element is clipped by any of its scrolling containers.
     * @param element Dimensions of the element (from getBoundingClientRect)
     * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
     * @returns Whether the element is clipped
     * @docs-private
     */
    function isElementClippedByScrolling(element, scrollContainers) {
        return scrollContainers.some(function (scrollContainerRect) {
            var clippedAbove = element.top < scrollContainerRect.top;
            var clippedBelow = element.bottom > scrollContainerRect.bottom;
            var clippedLeft = element.left < scrollContainerRect.left;
            var clippedRight = element.right > scrollContainerRect.right;
            return clippedAbove || clippedBelow || clippedLeft || clippedRight;
        });
    }

    // TODO: refactor clipping detection into a separate thing (part of scrolling module)
    // TODO: doesn't handle both flexible width and height when it has to scroll along both axis.
    /** Class to be added to the overlay bounding box. */
    var boundingBoxClass = 'cdk-overlay-connected-position-bounding-box';
    /** Regex used to split a string on its CSS units. */
    var cssUnitPattern = /([A-Za-z%]+)$/;
    /**
     * A strategy for positioning overlays. Using this strategy, an overlay is given an
     * implicit position relative some origin element. The relative position is defined in terms of
     * a point on the origin element that is connected to a point on the overlay element. For example,
     * a basic dropdown is connecting the bottom-left corner of the origin to the top-left corner
     * of the overlay.
     */
    var FlexibleConnectedPositionStrategy17 = /** @class */ (function () {
        function FlexibleConnectedPositionStrategy17(connectedTo, _viewportRuler, _document, _platform, _overlayContainer) {
            this._viewportRuler = _viewportRuler;
            this._document = _document;
            this._platform = _platform;
            this._overlayContainer = _overlayContainer;
            /** Last size used for the bounding box. Used to avoid resizing the overlay after open. */
            this._lastBoundingBoxSize = { width: 0, height: 0 };
            /** Whether the overlay was pushed in a previous positioning. */
            this._isPushed = false;
            /** Whether the overlay can be pushed on-screen on the initial open. */
            this._canPush = true;
            /** Whether the overlay can grow via flexible width/height after the initial open. */
            this._growAfterOpen = false;
            /** Whether the overlay's width and height can be constrained to fit within the viewport. */
            this._hasFlexibleDimensions = true;
            /** Whether the overlay position is locked. */
            this._positionLocked = false;
            /** Amount of space that must be maintained between the overlay and the edge of the viewport. */
            this._viewportMargin = 0;
            /** The Scrollable containers used to check scrollable view properties on position change. */
            this._scrollables = [];
            /** Ordered list of preferred positions, from most to least desirable. */
            this._preferredPositions = [];
            /** Subject that emits whenever the position changes. */
            this._positionChanges = new rxjs.Subject();
            /** Subscription to viewport size changes. */
            this._resizeSubscription = rxjs.Subscription.EMPTY;
            /** Default offset for the overlay along the x axis. */
            this._offsetX = 0;
            /** Default offset for the overlay along the y axis. */
            this._offsetY = 0;
            /** Keeps track of the CSS classes that the position strategy has applied on the overlay panel. */
            this._appliedPanelClasses = [];
            /** Observable sequence of position changes. */
            this.positionChanges = this._positionChanges;
            this.setOrigin(connectedTo);
        }
        Object.defineProperty(FlexibleConnectedPositionStrategy17.prototype, "positions", {
            /** Ordered list of preferred positions, from most to least desirable. */
            get: function () {
                return this._preferredPositions;
            },
            enumerable: false,
            configurable: true
        });
        /** Attaches this position strategy to an overlay. */
        FlexibleConnectedPositionStrategy17.prototype.attach = function (overlayRef) {
            var _this = this;
            if (this._overlayRef && overlayRef !== this._overlayRef) {
                throw Error('This position strategy is already attached to an overlay');
            }
            this._validatePositions();
            overlayRef.hostElement.classList.add(boundingBoxClass);
            this._overlayRef = overlayRef;
            this._boundingBox = overlayRef.hostElement;
            this._pane = overlayRef.overlayElement;
            this._isDisposed = false;
            this._isInitialRender = true;
            this._lastPosition = null;
            this._resizeSubscription.unsubscribe();
            this._resizeSubscription = this._viewportRuler.change().subscribe(function () {
                // When the window is resized, we want to trigger the next reposition as if it
                // was an initial render, in order for the strategy to pick a new optimal position,
                // otherwise position locking will cause it to stay at the old one.
                _this._isInitialRender = true;
                _this.apply();
            });
        };
        /**
         * Updates the position of the overlay element, using whichever preferred position relative
         * to the origin best fits on-screen.
         *
         * The selection of a position goes as follows:
         *  - If any positions fit completely within the viewport as-is,
         *      choose the first position that does so.
         *  - If flexible dimensions are enabled and at least one satisfies the given minimum width/height,
         *      choose the position with the greatest available size modified by the positions' weight.
         *  - If pushing is enabled, take the position that went off-screen the least and push it
         *      on-screen.
         *  - If none of the previous criteria were met, use the position that goes off-screen the least.
         * @docs-private
         */
        FlexibleConnectedPositionStrategy17.prototype.apply = function () {
            var e_1, _a, e_2, _b;
            // We shouldn't do anything if the strategy was disposed or we're on the server.
            if (this._isDisposed || !this._platform.isBrowser) {
                return;
            }
            // If the position has been applied already (e.g. when the overlay was opened) and the
            // consumer opted into locking in the position, re-use the old position, in order to
            // prevent the overlay from jumping around.
            if (!this._isInitialRender && this._positionLocked && this._lastPosition) {
                this.reapplyLastPosition();
                return;
            }
            this._clearPanelClasses();
            this._resetOverlayElementStyles();
            this._resetBoundingBoxStyles();
            // We need the bounding rects for the origin, the overlay and the container to determine how to position
            // the overlay relative to the origin.
            // We use the viewport rect to determine whether a position would go off-screen.
            this._viewportRect = this._getNarrowedViewportRect();
            this._originRect = this._getOriginRect();
            this._overlayRect = this._pane.getBoundingClientRect();
            this._containerRect = this._overlayContainer.getContainerElement().getBoundingClientRect();
            var originRect = this._originRect;
            var overlayRect = this._overlayRect;
            var viewportRect = this._viewportRect;
            var containerRect = this._containerRect;
            // Positions where the overlay will fit with flexible dimensions.
            var flexibleFits = [];
            // Fallback if none of the preferred positions fit within the viewport.
            var fallback;
            try {
                // Go through each of the preferred positions looking for a good fit.
                // If a good fit is found, it will be applied immediately.
                for (var _c = __values(this._preferredPositions), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var pos = _d.value;
                    // Get the exact (x, y) coordinate for the point-of-origin on the origin element.
                    var originPoint = this._getOriginPoint(originRect, containerRect, pos);
                    // From that point-of-origin, get the exact (x, y) coordinate for the top-left corner of the
                    // overlay in this position. We use the top-left corner for calculations and later translate
                    // this into an appropriate (top, left, bottom, right) style.
                    var overlayPoint = this._getOverlayPoint(originPoint, overlayRect, pos);
                    // Calculate how well the overlay would fit into the viewport with this point.
                    var overlayFit = this._getOverlayFit(overlayPoint, overlayRect, viewportRect, pos);
                    // If the overlay, without any further work, fits into the viewport, use this position.
                    if (overlayFit.isCompletelyWithinViewport) {
                        this._isPushed = false;
                        this._applyPosition(pos, originPoint);
                        return;
                    }
                    // If the overlay has flexible dimensions, we can use this position
                    // so long as there's enough space for the minimum dimensions.
                    if (this._canFitWithFlexibleDimensions(overlayFit, overlayPoint, viewportRect)) {
                        // Save positions where the overlay will fit with flexible dimensions. We will use these
                        // if none of the positions fit *without* flexible dimensions.
                        flexibleFits.push({
                            position: pos,
                            origin: originPoint,
                            overlayRect: overlayRect,
                            boundingBoxRect: this._calculateBoundingBoxRect(originPoint, pos),
                        });
                        continue;
                    }
                    // If the current preferred position does not fit on the screen, remember the position
                    // if it has more visible area on-screen than we've seen and move onto the next preferred
                    // position.
                    if (!fallback || fallback.overlayFit.visibleArea < overlayFit.visibleArea) {
                        fallback = { overlayFit: overlayFit, overlayPoint: overlayPoint, originPoint: originPoint, position: pos, overlayRect: overlayRect };
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // If there are any positions where the overlay would fit with flexible dimensions, choose the
            // one that has the greatest area available modified by the position's weight
            if (flexibleFits.length) {
                var bestFit = null;
                var bestScore = -1;
                try {
                    for (var flexibleFits_1 = __values(flexibleFits), flexibleFits_1_1 = flexibleFits_1.next(); !flexibleFits_1_1.done; flexibleFits_1_1 = flexibleFits_1.next()) {
                        var fit = flexibleFits_1_1.value;
                        var score = fit.boundingBoxRect.width * fit.boundingBoxRect.height * (fit.position.weight || 1);
                        if (score > bestScore) {
                            bestScore = score;
                            bestFit = fit;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (flexibleFits_1_1 && !flexibleFits_1_1.done && (_b = flexibleFits_1.return)) _b.call(flexibleFits_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                this._isPushed = false;
                this._applyPosition(bestFit.position, bestFit.origin);
                return;
            }
            // When none of the preferred positions fit within the viewport, take the position
            // that went off-screen the least and attempt to push it on-screen.
            if (this._canPush) {
                // TODO(jelbourn): after pushing, the opening "direction" of the overlay might not make sense.
                this._isPushed = true;
                this._applyPosition(fallback.position, fallback.originPoint);
                return;
            }
            // All options for getting the overlay within the viewport have been exhausted, so go with the
            // position that went off-screen the least.
            this._applyPosition(fallback.position, fallback.originPoint);
        };
        FlexibleConnectedPositionStrategy17.prototype.detach = function () {
            this._clearPanelClasses();
            this._lastPosition = null;
            this._previousPushAmount = null;
            this._resizeSubscription.unsubscribe();
        };
        /** Cleanup after the element gets destroyed. */
        FlexibleConnectedPositionStrategy17.prototype.dispose = function () {
            if (this._isDisposed) {
                return;
            }
            // We can't use `_resetBoundingBoxStyles` here, because it resets
            // some properties to zero, rather than removing them.
            if (this._boundingBox) {
                extendStyles(this._boundingBox.style, {
                    top: '',
                    left: '',
                    right: '',
                    bottom: '',
                    height: '',
                    width: '',
                    alignItems: '',
                    justifyContent: '',
                });
            }
            if (this._pane) {
                this._resetOverlayElementStyles();
            }
            if (this._overlayRef) {
                this._overlayRef.hostElement.classList.remove(boundingBoxClass);
            }
            this.detach();
            this._positionChanges.complete();
            this._overlayRef = this._boundingBox = null;
            this._isDisposed = true;
        };
        /**
         * This re-aligns the overlay element with the trigger in its last calculated position,
         * even if a position higher in the "preferred positions" list would now fit. This
         * allows one to re-align the panel without changing the orientation of the panel.
         */
        FlexibleConnectedPositionStrategy17.prototype.reapplyLastPosition = function () {
            if (this._isDisposed || !this._platform.isBrowser) {
                return;
            }
            var lastPosition = this._lastPosition;
            if (lastPosition) {
                this._originRect = this._getOriginRect();
                this._overlayRect = this._pane.getBoundingClientRect();
                this._viewportRect = this._getNarrowedViewportRect();
                this._containerRect = this._overlayContainer.getContainerElement().getBoundingClientRect();
                var originPoint = this._getOriginPoint(this._originRect, this._containerRect, lastPosition);
                this._applyPosition(lastPosition, originPoint);
            }
            else {
                this.apply();
            }
        };
        /**
         * Sets the list of Scrollable containers that host the origin element so that
         * on reposition we can evaluate if it or the overlay has been clipped or outside view. Every
         * Scrollable must be an ancestor element of the strategy's origin element.
         */
        FlexibleConnectedPositionStrategy17.prototype.withScrollableContainers = function (scrollables) {
            this._scrollables = scrollables;
            return this;
        };
        /**
         * Adds new preferred positions.
         * @param positions List of positions options for this overlay.
         */
        FlexibleConnectedPositionStrategy17.prototype.withPositions = function (positions) {
            this._preferredPositions = positions;
            // If the last calculated position object isn't part of the positions anymore, clear
            // it in order to avoid it being picked up if the consumer tries to re-apply.
            if (positions.indexOf(this._lastPosition) === -1) {
                this._lastPosition = null;
            }
            this._validatePositions();
            return this;
        };
        /**
         * Sets a minimum distance the overlay may be positioned to the edge of the viewport.
         * @param margin Required margin between the overlay and the viewport edge in pixels.
         */
        FlexibleConnectedPositionStrategy17.prototype.withViewportMargin = function (margin) {
            this._viewportMargin = margin;
            return this;
        };
        /** Sets whether the overlay's width and height can be constrained to fit within the viewport. */
        FlexibleConnectedPositionStrategy17.prototype.withFlexibleDimensions = function (flexibleDimensions) {
            if (flexibleDimensions === void 0) { flexibleDimensions = true; }
            this._hasFlexibleDimensions = flexibleDimensions;
            return this;
        };
        /** Sets whether the overlay can grow after the initial open via flexible width/height. */
        FlexibleConnectedPositionStrategy17.prototype.withGrowAfterOpen = function (growAfterOpen) {
            if (growAfterOpen === void 0) { growAfterOpen = true; }
            this._growAfterOpen = growAfterOpen;
            return this;
        };
        /** Sets whether the overlay can be pushed on-screen if none of the provided positions fit. */
        FlexibleConnectedPositionStrategy17.prototype.withPush = function (canPush) {
            if (canPush === void 0) { canPush = true; }
            this._canPush = canPush;
            return this;
        };
        /**
         * Sets whether the overlay's position should be locked in after it is positioned
         * initially. When an overlay is locked in, it won't attempt to reposition itself
         * when the position is re-applied (e.g. when the user scrolls away).
         * @param isLocked Whether the overlay should locked in.
         */
        FlexibleConnectedPositionStrategy17.prototype.withLockedPosition = function (isLocked) {
            if (isLocked === void 0) { isLocked = true; }
            this._positionLocked = isLocked;
            return this;
        };
        /**
         * Sets the origin, relative to which to position the overlay.
         * Using an element origin is useful for building components that need to be positioned
         * relatively to a trigger (e.g. dropdown menus or tooltips), whereas using a point can be
         * used for cases like contextual menus which open relative to the user's pointer.
         * @param origin Reference to the new origin.
         */
        FlexibleConnectedPositionStrategy17.prototype.setOrigin = function (origin) {
            this._origin = origin;
            return this;
        };
        /**
         * Sets the default offset for the overlay's connection point on the x-axis.
         * @param offset New offset in the X axis.
         */
        FlexibleConnectedPositionStrategy17.prototype.withDefaultOffsetX = function (offset) {
            this._offsetX = offset;
            return this;
        };
        /**
         * Sets the default offset for the overlay's connection point on the y-axis.
         * @param offset New offset in the Y axis.
         */
        FlexibleConnectedPositionStrategy17.prototype.withDefaultOffsetY = function (offset) {
            this._offsetY = offset;
            return this;
        };
        /**
         * Configures that the position strategy should set a `transform-origin` on some elements
         * inside the overlay, depending on the current position that is being applied. This is
         * useful for the cases where the origin of an animation can change depending on the
         * alignment of the overlay.
         * @param selector CSS selector that will be used to find the target
         *    elements onto which to set the transform origin.
         */
        FlexibleConnectedPositionStrategy17.prototype.withTransformOriginOn = function (selector) {
            this._transformOriginSelector = selector;
            return this;
        };
        /**
         * Gets the (x, y) coordinate of a connection point on the origin based on a relative position.
         */
        FlexibleConnectedPositionStrategy17.prototype._getOriginPoint = function (originRect, containerRect, pos) {
            var x;
            if (pos.originX == 'center') {
                // Note: when centering we should always use the `left`
                // offset, otherwise the position will be wrong in RTL.
                x = originRect.left + originRect.width / 2;
            }
            else {
                var startX = this._isRtl() ? originRect.right : originRect.left;
                var endX = this._isRtl() ? originRect.left : originRect.right;
                x = pos.originX == 'start' ? startX : endX;
            }
            // When zooming in Safari the container rectangle contains negative values for the position
            // and we need to re-add them to the calculated coordinates.
            if (containerRect.left < 0) {
                x -= containerRect.left;
            }
            var y;
            if (pos.originY == 'center') {
                y = originRect.top + originRect.height / 2;
            }
            else {
                y = pos.originY == 'top' ? originRect.top : originRect.bottom;
            }
            // Normally the containerRect's top value would be zero, however when the overlay is attached to an input
            // (e.g. in an autocomplete), mobile browsers will shift everything in order to put the input in the middle
            // of the screen and to make space for the virtual keyboard. We need to account for this offset,
            // otherwise our positioning will be thrown off.
            // Additionally, when zooming in Safari this fixes the vertical position.
            if (containerRect.top < 0) {
                y -= containerRect.top;
            }
            return { x: x, y: y };
        };
        /**
         * Gets the (x, y) coordinate of the top-left corner of the overlay given a given position and
         * origin point to which the overlay should be connected.
         */
        FlexibleConnectedPositionStrategy17.prototype._getOverlayPoint = function (originPoint, overlayRect, pos) {
            // Calculate the (overlayStartX, overlayStartY), the start of the
            // potential overlay position relative to the origin point.
            var overlayStartX;
            if (pos.overlayX == 'center') {
                overlayStartX = -overlayRect.width / 2;
            }
            else if (pos.overlayX === 'start') {
                overlayStartX = this._isRtl() ? -overlayRect.width : 0;
            }
            else {
                overlayStartX = this._isRtl() ? 0 : -overlayRect.width;
            }
            var overlayStartY;
            if (pos.overlayY == 'center') {
                overlayStartY = -overlayRect.height / 2;
            }
            else {
                overlayStartY = pos.overlayY == 'top' ? 0 : -overlayRect.height;
            }
            // The (x, y) coordinates of the overlay.
            return {
                x: originPoint.x + overlayStartX,
                y: originPoint.y + overlayStartY,
            };
        };
        /** Gets how well an overlay at the given point will fit within the viewport. */
        FlexibleConnectedPositionStrategy17.prototype._getOverlayFit = function (point, rawOverlayRect, viewport, position) {
            // Round the overlay rect when comparing against the
            // viewport, because the viewport is always rounded.
            var overlay = getRoundedBoundingClientRect(rawOverlayRect);
            var x = point.x, y = point.y;
            var offsetX = this._getOffset(position, 'x');
            var offsetY = this._getOffset(position, 'y');
            // Account for the offsets since they could push the overlay out of the viewport.
            if (offsetX) {
                x += offsetX;
            }
            if (offsetY) {
                y += offsetY;
            }
            // How much the overlay would overflow at this position, on each side.
            var leftOverflow = 0 - x;
            var rightOverflow = x + overlay.width - viewport.width;
            var topOverflow = 0 - y;
            var bottomOverflow = y + overlay.height - viewport.height;
            // Visible parts of the element on each axis.
            var visibleWidth = this._subtractOverflows(overlay.width, leftOverflow, rightOverflow);
            var visibleHeight = this._subtractOverflows(overlay.height, topOverflow, bottomOverflow);
            var visibleArea = visibleWidth * visibleHeight;
            return {
                visibleArea: visibleArea,
                isCompletelyWithinViewport: overlay.width * overlay.height === visibleArea,
                fitsInViewportVertically: visibleHeight === overlay.height,
                fitsInViewportHorizontally: visibleWidth == overlay.width,
            };
        };
        /**
         * Whether the overlay can fit within the viewport when it may resize either its width or height.
         * @param fit How well the overlay fits in the viewport at some position.
         * @param point The (x, y) coordinates of the overlay at some position.
         * @param viewport The geometry of the viewport.
         */
        FlexibleConnectedPositionStrategy17.prototype._canFitWithFlexibleDimensions = function (fit, point, viewport) {
            if (this._hasFlexibleDimensions) {
                var availableHeight = viewport.bottom - point.y;
                var availableWidth = viewport.right - point.x;
                var minHeight = getPixelValue(this._overlayRef.getConfig().minHeight);
                var minWidth = getPixelValue(this._overlayRef.getConfig().minWidth);
                var verticalFit = fit.fitsInViewportVertically || (minHeight != null && minHeight <= availableHeight);
                var horizontalFit = fit.fitsInViewportHorizontally || (minWidth != null && minWidth <= availableWidth);
                return verticalFit && horizontalFit;
            }
            return false;
        };
        /**
         * Gets the point at which the overlay can be "pushed" on-screen. If the overlay is larger than
         * the viewport, the top-left corner will be pushed on-screen (with overflow occurring on the
         * right and bottom).
         *
         * @param start Starting point from which the overlay is pushed.
         * @param rawOverlayRect Dimensions of the overlay.
         * @param scrollPosition Current viewport scroll position.
         * @returns The point at which to position the overlay after pushing. This is effectively a new
         *     originPoint.
         */
        FlexibleConnectedPositionStrategy17.prototype._pushOverlayOnScreen = function (start, rawOverlayRect, scrollPosition) {
            // If the position is locked and we've pushed the overlay already, reuse the previous push
            // amount, rather than pushing it again. If we were to continue pushing, the element would
            // remain in the viewport, which goes against the expectations when position locking is enabled.
            if (this._previousPushAmount && this._positionLocked) {
                return {
                    x: start.x + this._previousPushAmount.x,
                    y: start.y + this._previousPushAmount.y,
                };
            }
            // Round the overlay rect when comparing against the
            // viewport, because the viewport is always rounded.
            var overlay = getRoundedBoundingClientRect(rawOverlayRect);
            var viewport = this._viewportRect;
            // Determine how much the overlay goes outside the viewport on each
            // side, which we'll use to decide which direction to push it.
            var overflowRight = Math.max(start.x + overlay.width - viewport.width, 0);
            var overflowBottom = Math.max(start.y + overlay.height - viewport.height, 0);
            var overflowTop = Math.max(viewport.top - scrollPosition.top - start.y, 0);
            var overflowLeft = Math.max(viewport.left - scrollPosition.left - start.x, 0);
            // Amount by which to push the overlay in each axis such that it remains on-screen.
            var pushX = 0;
            var pushY = 0;
            // If the overlay fits completely within the bounds of the viewport, push it from whichever
            // direction is goes off-screen. Otherwise, push the top-left corner such that its in the
            // viewport and allow for the trailing end of the overlay to go out of bounds.
            if (overlay.width <= viewport.width) {
                pushX = overflowLeft || -overflowRight;
            }
            else {
                pushX = start.x < this._viewportMargin ? viewport.left - scrollPosition.left - start.x : 0;
            }
            if (overlay.height <= viewport.height) {
                pushY = overflowTop || -overflowBottom;
            }
            else {
                pushY = start.y < this._viewportMargin ? viewport.top - scrollPosition.top - start.y : 0;
            }
            this._previousPushAmount = { x: pushX, y: pushY };
            return {
                x: start.x + pushX,
                y: start.y + pushY,
            };
        };
        /**
         * Applies a computed position to the overlay and emits a position change.
         * @param position The position preference
         * @param originPoint The point on the origin element where the overlay is connected.
         */
        FlexibleConnectedPositionStrategy17.prototype._applyPosition = function (position, originPoint) {
            this._setTransformOrigin(position);
            this._setOverlayElementStyles(originPoint, position);
            this._setBoundingBoxStyles(originPoint, position);
            if (position.panelClass) {
                this._addPanelClasses(position.panelClass);
            }
            // Save the last connected position in case the position needs to be re-calculated.
            this._lastPosition = position;
            // Notify that the position has been changed along with its change properties.
            // We only emit if we've got any subscriptions, because the scroll visibility
            // calculations can be somewhat expensive.
            if (this._positionChanges.observers.length) {
                var scrollableViewProperties = this._getScrollVisibility();
                var changeEvent = new overlay.ConnectedOverlayPositionChange(position, scrollableViewProperties);
                this._positionChanges.next(changeEvent);
            }
            this._isInitialRender = false;
        };
        /** Sets the transform origin based on the configured selector and the passed-in position.  */
        FlexibleConnectedPositionStrategy17.prototype._setTransformOrigin = function (position) {
            if (!this._transformOriginSelector) {
                return;
            }
            var elements = this._boundingBox.querySelectorAll(this._transformOriginSelector);
            var xOrigin;
            var yOrigin = position.overlayY;
            if (position.overlayX === 'center') {
                xOrigin = 'center';
            }
            else if (this._isRtl()) {
                xOrigin = position.overlayX === 'start' ? 'right' : 'left';
            }
            else {
                xOrigin = position.overlayX === 'start' ? 'left' : 'right';
            }
            for (var i = 0; i < elements.length; i++) {
                elements[i].style.transformOrigin = xOrigin + " " + yOrigin;
            }
        };
        /**
         * Gets the position and size of the overlay's sizing container.
         *
         * This method does no measuring and applies no styles so that we can cheaply compute the
         * bounds for all positions and choose the best fit based on these results.
         */
        FlexibleConnectedPositionStrategy17.prototype._calculateBoundingBoxRect = function (origin, position) {
            var viewport = this._viewportRect;
            var isRtl = this._isRtl();
            var height, top, bottom;
            if (position.overlayY === 'top') {
                // Overlay is opening "downward" and thus is bound by the bottom viewport edge.
                top = origin.y;
                height = viewport.height - top + this._viewportMargin;
            }
            else if (position.overlayY === 'bottom') {
                // Overlay is opening "upward" and thus is bound by the top viewport edge. We need to add
                // the viewport margin back in, because the viewport rect is narrowed down to remove the
                // margin, whereas the `origin` position is calculated based on its `DOMRect`.
                bottom = viewport.height - origin.y + this._viewportMargin * 2;
                height = viewport.height - bottom + this._viewportMargin;
            }
            else {
                // If neither top nor bottom, it means that the overlay is vertically centered on the
                // origin point. Note that we want the position relative to the viewport, rather than
                // the page, which is why we don't use something like `viewport.bottom - origin.y` and
                // `origin.y - viewport.top`.
                var smallestDistanceToViewportEdge = Math.min(viewport.bottom - origin.y + viewport.top, origin.y);
                var previousHeight = this._lastBoundingBoxSize.height;
                height = smallestDistanceToViewportEdge * 2;
                top = origin.y - smallestDistanceToViewportEdge;
                if (height > previousHeight && !this._isInitialRender && !this._growAfterOpen) {
                    top = origin.y - previousHeight / 2;
                }
            }
            // The overlay is opening 'right-ward' (the content flows to the right).
            var isBoundedByRightViewportEdge = (position.overlayX === 'start' && !isRtl) || (position.overlayX === 'end' && isRtl);
            // The overlay is opening 'left-ward' (the content flows to the left).
            var isBoundedByLeftViewportEdge = (position.overlayX === 'end' && !isRtl) || (position.overlayX === 'start' && isRtl);
            var width, left, right;
            if (isBoundedByLeftViewportEdge) {
                right = viewport.width - origin.x + this._viewportMargin;
                width = origin.x - this._viewportMargin;
            }
            else if (isBoundedByRightViewportEdge) {
                left = origin.x;
                width = viewport.right - origin.x;
            }
            else {
                // If neither start nor end, it means that the overlay is horizontally centered on the
                // origin point. Note that we want the position relative to the viewport, rather than
                // the page, which is why we don't use something like `viewport.right - origin.x` and
                // `origin.x - viewport.left`.
                var smallestDistanceToViewportEdge = Math.min(viewport.right - origin.x + viewport.left, origin.x);
                var previousWidth = this._lastBoundingBoxSize.width;
                width = smallestDistanceToViewportEdge * 2;
                left = origin.x - smallestDistanceToViewportEdge;
                if (width > previousWidth && !this._isInitialRender && !this._growAfterOpen) {
                    left = origin.x - previousWidth / 2;
                }
            }
            return { top: top, left: left, bottom: bottom, right: right, width: width, height: height };
        };
        /**
         * Sets the position and size of the overlay's sizing wrapper. The wrapper is positioned on the
         * origin's connection point and stretches to the bounds of the viewport.
         *
         * @param origin The point on the origin element where the overlay is connected.
         * @param position The position preference
         */
        FlexibleConnectedPositionStrategy17.prototype._setBoundingBoxStyles = function (origin, position) {
            var boundingBoxRect = this._calculateBoundingBoxRect(origin, position);
            // It's weird if the overlay *grows* while scrolling, so we take the last size into account
            // when applying a new size.
            if (!this._isInitialRender && !this._growAfterOpen) {
                boundingBoxRect.height = Math.min(boundingBoxRect.height, this._lastBoundingBoxSize.height);
                boundingBoxRect.width = Math.min(boundingBoxRect.width, this._lastBoundingBoxSize.width);
            }
            var styles = {};
            if (this._hasExactPosition()) {
                styles.top = styles.left = '0';
                styles.bottom = styles.right = styles.maxHeight = styles.maxWidth = '';
                styles.width = styles.height = '100%';
            }
            else {
                var maxHeight = this._overlayRef.getConfig().maxHeight;
                var maxWidth = this._overlayRef.getConfig().maxWidth;
                styles.height = coercion.coerceCssPixelValue(boundingBoxRect.height);
                styles.top = coercion.coerceCssPixelValue(boundingBoxRect.top);
                styles.bottom = coercion.coerceCssPixelValue(boundingBoxRect.bottom);
                styles.width = coercion.coerceCssPixelValue(boundingBoxRect.width);
                styles.left = coercion.coerceCssPixelValue(boundingBoxRect.left);
                styles.right = coercion.coerceCssPixelValue(boundingBoxRect.right);
                // Push the pane content towards the proper direction.
                if (position.overlayX === 'center') {
                    styles.alignItems = 'center';
                }
                else {
                    styles.alignItems = position.overlayX === 'end' ? 'flex-end' : 'flex-start';
                }
                if (position.overlayY === 'center') {
                    styles.justifyContent = 'center';
                }
                else {
                    styles.justifyContent = position.overlayY === 'bottom' ? 'flex-end' : 'flex-start';
                }
                if (maxHeight) {
                    styles.maxHeight = coercion.coerceCssPixelValue(maxHeight);
                }
                if (maxWidth) {
                    styles.maxWidth = coercion.coerceCssPixelValue(maxWidth);
                }
            }
            this._lastBoundingBoxSize = boundingBoxRect;
            extendStyles(this._boundingBox.style, styles);
        };
        /** Resets the styles for the bounding box so that a new positioning can be computed. */
        FlexibleConnectedPositionStrategy17.prototype._resetBoundingBoxStyles = function () {
            extendStyles(this._boundingBox.style, {
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                height: '',
                width: '',
                alignItems: '',
                justifyContent: '',
            });
        };
        /** Resets the styles for the overlay pane so that a new positioning can be computed. */
        FlexibleConnectedPositionStrategy17.prototype._resetOverlayElementStyles = function () {
            extendStyles(this._pane.style, {
                top: '',
                left: '',
                bottom: '',
                right: '',
                position: '',
                transform: '',
            });
        };
        /** Sets positioning styles to the overlay element. */
        FlexibleConnectedPositionStrategy17.prototype._setOverlayElementStyles = function (originPoint, position) {
            var styles = {};
            var hasExactPosition = this._hasExactPosition();
            var hasFlexibleDimensions = this._hasFlexibleDimensions;
            var config = this._overlayRef.getConfig();
            if (hasExactPosition) {
                var scrollPosition = this._viewportRuler.getViewportScrollPosition();
                extendStyles(styles, this._getExactOverlayY(position, originPoint, scrollPosition));
                extendStyles(styles, this._getExactOverlayX(position, originPoint, scrollPosition));
            }
            else {
                styles.position = 'static';
            }
            // Use a transform to apply the offsets. We do this because the `center` positions rely on
            // being in the normal flex flow and setting a `top` / `left` at all will completely throw
            // off the position. We also can't use margins, because they won't have an effect in some
            // cases where the element doesn't have anything to "push off of". Finally, this works
            // better both with flexible and non-flexible positioning.
            var transformString = '';
            var offsetX = this._getOffset(position, 'x');
            var offsetY = this._getOffset(position, 'y');
            if (offsetX) {
                transformString += "translateX(" + offsetX + "px) ";
            }
            if (offsetY) {
                transformString += "translateY(" + offsetY + "px)";
            }
            styles.transform = transformString.trim();
            // If a maxWidth or maxHeight is specified on the overlay, we remove them. We do this because
            // we need these values to both be set to "100%" for the automatic flexible sizing to work.
            // The maxHeight and maxWidth are set on the boundingBox in order to enforce the constraint.
            // Note that this doesn't apply when we have an exact position, in which case we do want to
            // apply them because they'll be cleared from the bounding box.
            if (config.maxHeight) {
                if (hasExactPosition) {
                    styles.maxHeight = coercion.coerceCssPixelValue(config.maxHeight);
                }
                else if (hasFlexibleDimensions) {
                    styles.maxHeight = '';
                }
            }
            if (config.maxWidth) {
                if (hasExactPosition) {
                    styles.maxWidth = coercion.coerceCssPixelValue(config.maxWidth);
                }
                else if (hasFlexibleDimensions) {
                    styles.maxWidth = '';
                }
            }
            extendStyles(this._pane.style, styles);
        };
        /** Gets the exact top/bottom for the overlay when not using flexible sizing or when pushing. */
        FlexibleConnectedPositionStrategy17.prototype._getExactOverlayY = function (position, originPoint, scrollPosition) {
            // Reset any existing styles. This is necessary in case the
            // preferred position has changed since the last `apply`.
            var styles = { top: '', bottom: '' };
            var overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
            if (this._isPushed) {
                overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
            }
            // We want to set either `top` or `bottom` based on whether the overlay wants to appear
            // above or below the origin and the direction in which the element will expand.
            if (position.overlayY === 'bottom') {
                // When using `bottom`, we adjust the y position such that it is the distance
                // from the bottom of the viewport rather than the top.
                var documentHeight = this._document.documentElement.clientHeight;
                styles.bottom = documentHeight - (overlayPoint.y + this._overlayRect.height) + "px";
            }
            else {
                styles.top = coercion.coerceCssPixelValue(overlayPoint.y);
            }
            return styles;
        };
        /** Gets the exact left/right for the overlay when not using flexible sizing or when pushing. */
        FlexibleConnectedPositionStrategy17.prototype._getExactOverlayX = function (position, originPoint, scrollPosition) {
            // Reset any existing styles. This is necessary in case the preferred position has
            // changed since the last `apply`.
            var styles = { left: '', right: '' };
            var overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
            if (this._isPushed) {
                overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
            }
            // We want to set either `left` or `right` based on whether the overlay wants to appear "before"
            // or "after" the origin, which determines the direction in which the element will expand.
            // For the horizontal axis, the meaning of "before" and "after" change based on whether the
            // page is in RTL or LTR.
            var horizontalStyleProperty;
            if (this._isRtl()) {
                horizontalStyleProperty = position.overlayX === 'end' ? 'left' : 'right';
            }
            else {
                horizontalStyleProperty = position.overlayX === 'end' ? 'right' : 'left';
            }
            // When we're setting `right`, we adjust the x position such that it is the distance
            // from the right edge of the viewport rather than the left edge.
            if (horizontalStyleProperty === 'right') {
                var documentWidth = this._document.documentElement.clientWidth;
                styles.right = documentWidth - (overlayPoint.x + this._overlayRect.width) + "px";
            }
            else {
                styles.left = coercion.coerceCssPixelValue(overlayPoint.x);
            }
            return styles;
        };
        /**
         * Gets the view properties of the trigger and overlay, including whether they are clipped
         * or completely outside the view of any of the strategy's scrollables.
         */
        FlexibleConnectedPositionStrategy17.prototype._getScrollVisibility = function () {
            // Note: needs fresh rects since the position could've changed.
            var originBounds = this._getOriginRect();
            var overlayBounds = this._pane.getBoundingClientRect();
            // TODO(jelbourn): instead of needing all of the client rects for these scrolling containers
            // every time, we should be able to use the scrollTop of the containers if the size of those
            // containers hasn't changed.
            var scrollContainerBounds = this._scrollables.map(function (scrollable) {
                return scrollable.getElementRef().nativeElement.getBoundingClientRect();
            });
            return {
                isOriginClipped: isElementClippedByScrolling(originBounds, scrollContainerBounds),
                isOriginOutsideView: isElementScrolledOutsideView(originBounds, scrollContainerBounds),
                isOverlayClipped: isElementClippedByScrolling(overlayBounds, scrollContainerBounds),
                isOverlayOutsideView: isElementScrolledOutsideView(overlayBounds, scrollContainerBounds),
            };
        };
        /** Subtracts the amount that an element is overflowing on an axis from its length. */
        FlexibleConnectedPositionStrategy17.prototype._subtractOverflows = function (length) {
            var overflows = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                overflows[_i - 1] = arguments[_i];
            }
            return overflows.reduce(function (currentValue, currentOverflow) {
                return currentValue - Math.max(currentOverflow, 0);
            }, length);
        };
        /** Narrows the given viewport rect by the current _viewportMargin. */
        FlexibleConnectedPositionStrategy17.prototype._getNarrowedViewportRect = function () {
            // We recalculate the viewport rect here ourselves, rather than using the ViewportRuler,
            // because we want to use the `clientWidth` and `clientHeight` as the base. The difference
            // being that the client properties don't include the scrollbar, as opposed to `innerWidth`
            // and `innerHeight` that do. This is necessary, because the overlay container uses
            // 100% `width` and `height` which don't include the scrollbar either.
            var width = this._document.documentElement.clientWidth;
            var height = this._document.documentElement.clientHeight;
            var scrollPosition = this._viewportRuler.getViewportScrollPosition();
            return {
                top: scrollPosition.top + this._viewportMargin,
                left: scrollPosition.left + this._viewportMargin,
                right: scrollPosition.left + width - this._viewportMargin,
                bottom: scrollPosition.top + height - this._viewportMargin,
                width: width - 2 * this._viewportMargin,
                height: height - 2 * this._viewportMargin,
            };
        };
        /** Whether the we're dealing with an RTL context */
        FlexibleConnectedPositionStrategy17.prototype._isRtl = function () {
            return this._overlayRef.getDirection() === 'rtl';
        };
        /** Determines whether the overlay uses exact or flexible positioning. */
        FlexibleConnectedPositionStrategy17.prototype._hasExactPosition = function () {
            return !this._hasFlexibleDimensions || this._isPushed;
        };
        /** Retrieves the offset of a position along the x or y axis. */
        FlexibleConnectedPositionStrategy17.prototype._getOffset = function (position, axis) {
            if (axis === 'x') {
                // We don't do something like `position['offset' + axis]` in
                // order to avoid breaking minifiers that rename properties.
                return position.offsetX == null ? this._offsetX : position.offsetX;
            }
            return position.offsetY == null ? this._offsetY : position.offsetY;
        };
        /** Validates that the current position match the expected values. */
        FlexibleConnectedPositionStrategy17.prototype._validatePositions = function () {
            if (true) {
                if (!this._preferredPositions.length) {
                    throw Error('FlexibleConnectedPositionStrategy: At least one position is required.');
                }
                // TODO(crisbeto): remove these once Angular's template type
                // checking is advanced enough to catch these cases.
                this._preferredPositions.forEach(function (pair) {
                    overlay.validateHorizontalPosition('originX', pair.originX);
                    overlay.validateVerticalPosition('originY', pair.originY);
                    overlay.validateHorizontalPosition('overlayX', pair.overlayX);
                    overlay.validateVerticalPosition('overlayY', pair.overlayY);
                });
            }
        };
        /** Adds a single CSS class or an array of classes on the overlay panel. */
        FlexibleConnectedPositionStrategy17.prototype._addPanelClasses = function (cssClasses) {
            var _this = this;
            if (this._pane) {
                coercion.coerceArray(cssClasses).forEach(function (cssClass) {
                    if (cssClass !== '' && _this._appliedPanelClasses.indexOf(cssClass) === -1) {
                        _this._appliedPanelClasses.push(cssClass);
                        _this._pane.classList.add(cssClass);
                    }
                });
            }
        };
        /** Clears the classes that the position strategy has applied from the overlay panel. */
        FlexibleConnectedPositionStrategy17.prototype._clearPanelClasses = function () {
            var _this = this;
            if (this._pane) {
                this._appliedPanelClasses.forEach(function (cssClass) {
                    _this._pane.classList.remove(cssClass);
                });
                this._appliedPanelClasses = [];
            }
        };
        /** Returns the DOMRect of the current origin. */
        FlexibleConnectedPositionStrategy17.prototype._getOriginRect = function () {
            var origin = this._origin;
            if (origin instanceof core.ElementRef) {
                return origin.nativeElement.getBoundingClientRect();
            }
            // Check for Element so SVG elements are also supported.
            if (origin instanceof Element) {
                return origin.getBoundingClientRect();
            }
            var width = origin.width || 0;
            var height = origin.height || 0;
            // If the origin is a point, return a client rect as if it was a 0x0 element at the point.
            return {
                top: origin.y,
                bottom: origin.y + height,
                left: origin.x,
                right: origin.x + width,
                height: height,
                width: width,
            };
        };
        return FlexibleConnectedPositionStrategy17;
    }());
    /** Shallow-extends a stylesheet object with another stylesheet object. */
    function extendStyles(destination, source) {
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                destination[key] = source[key];
            }
        }
        return destination;
    }
    /**
     * Extracts the pixel value as a number from a value, if it's a number
     * or a CSS pixel string (e.g. `1337px`). Otherwise returns null.
     */
    function getPixelValue(input) {
        if (typeof input !== 'number' && input != null) {
            var _a = __read(input.split(cssUnitPattern), 2), value = _a[0], units = _a[1];
            return !units || units === 'px' ? parseFloat(value) : null;
        }
        return input || null;
    }
    /**
     * Gets a version of an element's bounding `DOMRect` where all the values are rounded down to
     * the nearest pixel. This allows us to account for the cases where there may be sub-pixel
     * deviations in the `DOMRect` returned by the browser (e.g. when zoomed in with a percentage
     * size, see #21350).
     */
    function getRoundedBoundingClientRect(clientRect) {
        return {
            top: Math.floor(clientRect.top),
            right: Math.floor(clientRect.right),
            bottom: Math.floor(clientRect.bottom),
            left: Math.floor(clientRect.left),
            width: Math.floor(clientRect.width),
            height: Math.floor(clientRect.height),
        };
    }
    var STANDARD_DROPDOWN_BELOW_POSITIONS = [
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
        { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
    ];
    var STANDARD_DROPDOWN_ADJACENT_POSITIONS = [
        { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top' },
        { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
        { originX: 'start', originY: 'bottom', overlayX: 'end', overlayY: 'bottom' },
    ];

    var FLYOUT_SHOW_HIDE_DELAY = 100;
    var HelpExtComponent = /** @class */ (function () {
        function HelpExtComponent(_cdr, _router, _overlay, _api, _viewportRuler, _document, _platform, _overlayContainer) {
            this._cdr = _cdr;
            this._router = _router;
            this._overlay = _overlay;
            this._api = _api;
            this._viewportRuler = _viewportRuler;
            this._document = _document;
            this._platform = _platform;
            this._overlayContainer = _overlayContainer;
            this.alwaysVisible = true;
            this.inline = false;
            this._onDestroy = new rxjs.Subject();
        }
        Object.defineProperty(HelpExtComponent.prototype, "article", {
            get: function () {
                return this._article;
            },
            set: function (value) {
                this._article = value;
                this._cdr.markForCheck();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(HelpExtComponent.prototype, "articleId", {
            get: function () {
                return this._articleId;
            },
            set: function (value) {
                var _this = this;
                if (this.articleUid)
                    throw Error('Do not use articleId with articleUid');
                if (this.byLocation)
                    throw Error('Do not use articleId with byLocation');
                if (this._articleId === value)
                    return;
                this._articleId = value;
                if (!value)
                    return;
                this._api.getArticleById(value).subscribe(function (article) { return (_this.article = article); }, function () { return (_this.article = null); });
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(HelpExtComponent.prototype, "articleUid", {
            get: function () {
                return this._articleUid;
            },
            set: function (value) {
                var _this = this;
                if (this.articleId)
                    throw Error('Do not use articleUid with articleId');
                if (this.byLocation)
                    throw Error('Do not use articleUid with byLocation');
                if (this._articleUid === value)
                    return;
                this._articleUid = value;
                if (!value)
                    return;
                this._api.getArticleByUid(location.origin, value).subscribe(function (article) { return (_this.article = article); }, function () { return (_this.article = null); });
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(HelpExtComponent.prototype, "byLocation", {
            get: function () {
                return this._byLocation;
            },
            set: function (value) {
                var _this = this;
                var _a;
                if (this.articleId)
                    throw Error('Do not use byLocation with articleId');
                if (this.articleUid)
                    throw Error('Do not use byLocation with articleUid');
                if (this._byLocation === value)
                    return;
                this._byLocation = value;
                if (value) {
                    this.updateFromLocation();
                    this._routerEventsSubscription = this._router.events
                        .pipe(operators.filter(function (event) { return event instanceof router.NavigationEnd; }))
                        .subscribe(function () {
                        _this.updateFromLocation();
                    });
                }
                else {
                    (_a = this._routerEventsSubscription) === null || _a === void 0 ? void 0 : _a.unsubscribe();
                }
            },
            enumerable: false,
            configurable: true
        });
        HelpExtComponent.prototype._onMouseEnter = function () {
            if (!this.article)
                return;
            this.show(FLYOUT_SHOW_HIDE_DELAY);
        };
        HelpExtComponent.prototype._onMouseLeave = function () {
            this.hide(FLYOUT_SHOW_HIDE_DELAY);
        };
        HelpExtComponent.prototype.show = function (delay) {
            var _this = this;
            clearTimeout(this._hideTimeoutId);
            clearTimeout(this._showTimeoutId);
            if (this._flyoutInstance)
                return;
            this._showTimeoutId = setTimeout(function () {
                _this._flyoutInstance = _this._overlayRef.attach(_this._portal).instance;
                _this._flyoutInstance.article = _this.article;
                _this._flyoutInstance.mouseEnter.subscribe(function () { return _this.show(FLYOUT_SHOW_HIDE_DELAY); });
                _this._flyoutInstance.mouseLeave.subscribe(function () { return _this.hide(FLYOUT_SHOW_HIDE_DELAY); });
                _this._flyoutInstance.show();
                setTimeout(function () { return _this._overlayRef.updatePosition(); });
                _this._showTimeoutId = undefined;
            }, delay);
        };
        HelpExtComponent.prototype.hide = function (delay) {
            var _this = this;
            clearTimeout(this._hideTimeoutId);
            clearTimeout(this._showTimeoutId);
            if (!this._flyoutInstance)
                return;
            this._hideTimeoutId = setTimeout(function () {
                _this._hideTimeoutId = undefined;
                _this._flyoutInstance.hide();
                _this._flyoutInstance.afterHidden.subscribe(function () {
                    _this._overlayRef.detach();
                    _this._flyoutInstance = undefined;
                });
            }, delay);
        };
        HelpExtComponent.prototype.ngOnInit = function () {
            this._portal = new portal.ComponentPortal(HelpExtFlyoutComponent);
            var positionStrategy = new FlexibleConnectedPositionStrategy17(this._helpQuestionElement, this._viewportRuler, this._document, this._platform, this._overlayContainer)
                .withFlexibleDimensions(false)
                .withGrowAfterOpen(true)
                .withPush(true)
                .withPositions([
                { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
                { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center' },
                { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center' },
                { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'top' },
                { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'top' },
                { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
            ]);
            var scrollStrategy = this._overlay.scrollStrategies.reposition();
            this._overlayRef = this._overlay.create({
                positionStrategy: positionStrategy,
                scrollStrategy: scrollStrategy,
                //maxHeight: window.innerHeight - this._helpQuestionElement.nativeElement.getBoundingClientRect().bottom,
                maxWidth: 'min(920px, 100vw)',
                panelClass: 'help-ext-panel',
            });
        };
        HelpExtComponent.prototype.ngOnDestroy = function () {
            var _a;
            this._onDestroy.next();
            this._onDestroy.complete();
            (_a = this._routerEventsSubscription) === null || _a === void 0 ? void 0 : _a.unsubscribe();
        };
        HelpExtComponent.prototype.updateFromLocation = function () {
            var _this = this;
            this._api.getArticleByUrl(location.origin + location.pathname).subscribe(function (article) { return (_this.article = article); }, function () { return (_this.article = null); });
        };
        return HelpExtComponent;
    }());
    HelpExtComponent.decorators = [
        { type: core.Component, args: [{
                    selector: 'help-ext',
                    template: "<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  width=\"24\"\n  class=\"help-ext-icon\"\n  [ngStyle]=\"{'font-size': inline ? '0.5em' : '10px'}\"\n  [class.invisible]=\"!(alwaysVisible || article)\"\n  [class.disabled]=\"!article\"\n  #helpQuestion\n>\n  <path d=\"M0 0h24v24H0z\" fill=\"none\" />\n  <path\n    d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z\"\n  />\n</svg>\n",
                    host: {
                        class: 'help-ext',
                    },
                    changeDetection: core.ChangeDetectionStrategy.OnPush
                },] }
    ];
    HelpExtComponent.ctorParameters = function () { return [
        { type: core.ChangeDetectorRef },
        { type: router.Router },
        { type: overlay.Overlay },
        { type: HelpExtService },
        { type: overlay.ViewportRuler },
        { type: undefined, decorators: [{ type: core.Inject, args: [common.DOCUMENT,] }] },
        { type: platform.Platform },
        { type: overlay.OverlayContainer }
    ]; };
    HelpExtComponent.propDecorators = {
        articleId: [{ type: core.Input }],
        articleUid: [{ type: core.Input }],
        byLocation: [{ type: core.Input }],
        alwaysVisible: [{ type: core.Input }],
        inline: [{ type: core.Input }],
        _helpQuestionElement: [{ type: core.ViewChild, args: ['helpQuestion', { static: true },] }],
        _onMouseEnter: [{ type: core.HostListener, args: ['mouseenter',] }],
        _onMouseLeave: [{ type: core.HostListener, args: ['mouseleave',] }]
    };

    var HelpExtArticleContentComponent = /** @class */ (function () {
        function HelpExtArticleContentComponent(_el, _api, _cdr) {
            this._el = _el;
            this._api = _api;
            this._cdr = _cdr;
        }
        Object.defineProperty(HelpExtArticleContentComponent.prototype, "article", {
            /**
             * @deprecated Use content instead
             * @see `content`
             */
            set: function (value) {
                this.content = value === null || value === void 0 ? void 0 : value.content;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(HelpExtArticleContentComponent.prototype, "content", {
            set: function (value) {
                var _this = this;
                this._api.baseAddress.subscribe(function (baseAddress) {
                    _this._el.nativeElement.innerHTML = _this._api.sanitizeContent(value);
                    _this._api.makeAbsoluteLinks(_this._el, baseAddress, '_blank');
                    _this._cdr.markForCheck();
                });
            },
            enumerable: false,
            configurable: true
        });
        return HelpExtArticleContentComponent;
    }());
    HelpExtArticleContentComponent.decorators = [
        { type: core.Component, args: [{
                    selector: 'help-ext-article-content',
                    template: '',
                    changeDetection: core.ChangeDetectionStrategy.OnPush
                },] }
    ];
    HelpExtArticleContentComponent.ctorParameters = function () { return [
        { type: core.ElementRef },
        { type: HelpExtService },
        { type: core.ChangeDetectorRef }
    ]; };
    HelpExtArticleContentComponent.propDecorators = {
        article: [{ type: core.Input }],
        content: [{ type: core.Input }]
    };

    var HelpExtUidDirective = /** @class */ (function () {
        function HelpExtUidDirective(_api, _host) {
            this._api = _api;
            this._host = _host;
        }
        Object.defineProperty(HelpExtUidDirective.prototype, "uid", {
            set: function (value) {
                var _this = this;
                this._api.getArticleByUid(location.origin, value).subscribe(function (article) { return (_this._host.article = article); }, function () { return (_this._host.article = null); });
            },
            enumerable: false,
            configurable: true
        });
        return HelpExtUidDirective;
    }());
    HelpExtUidDirective.decorators = [
        { type: core.Directive, args: [{
                    selector: 'help-ext-article-content[uid]',
                    exportAs: 'helpExtUid',
                },] }
    ];
    HelpExtUidDirective.ctorParameters = function () { return [
        { type: HelpExtService },
        { type: HelpExtArticleContentComponent }
    ]; };
    HelpExtUidDirective.propDecorators = {
        uid: [{ type: core.Input }]
    };

    var HelpExtAttachmentComponent = /** @class */ (function () {
        function HelpExtAttachmentComponent() {
        }
        return HelpExtAttachmentComponent;
    }());
    HelpExtAttachmentComponent.decorators = [
        { type: core.Component, args: [{
                    selector: 'help-ext-attachment',
                    template: "<a class=\"help-ext-flyout-attachment\" [href]=\"attachment.url\" target=\"_blank\">\n  <svg\n    class=\"help-ext-flyout-attachment-icon\"\n    xmlns=\"http://www.w3.org/2000/svg\"\n    viewBox=\"0 0 24 24\"\n    width=\"20\"\n    height=\"20\"\n  >\n    <path\n      d=\"M12.76 19.94A5.49 5.49 0 015 12.18l8.76-8.75a3.72 3.72 0 016.34 2.63A3.68 3.68 0 0119 8.68L10.67 17a1.36 1.36 0 01-1.92-1.9l8.34-8.34-1.42-1.41-8.34 8.34a3.36 3.36 0 004.75 4.75l8.35-8.34A5.72 5.72 0 0012.34 2l-8.76 8.77a7.49 7.49 0 0010.59 10.59l7.92-7.93L20.68 12z\"\n    />\n  </svg>\n  {{attachment.name}}\n</a>\n",
                    changeDetection: core.ChangeDetectionStrategy.OnPush
                },] }
    ];
    HelpExtAttachmentComponent.propDecorators = {
        attachment: [{ type: core.Input }]
    };

    var HelpExtModule = /** @class */ (function () {
        function HelpExtModule() {
        }
        HelpExtModule.forRoot = function (config) {
            return {
                ngModule: HelpExtModule,
                providers: [
                    config.helpExtUrlResolver || { provide: HelpExtUrlResolver, useValue: null },
                    {
                        provide: HELP_EXT_URL_TOKEN,
                        useValue: config.helpExtUrl,
                    },
                    {
                        provide: HELP_EXT_CACHE_LIFETIME_TOKEN,
                        useValue: isNaN(config.cacheLifetimeSecond) ? cacheLifetimeSecondDefault : config.cacheLifetimeSecond,
                    },
                    {
                        provide: HELP_EXT_HTTP_HEADERS,
                        useValue: config.httpHeaders,
                    },
                    HelpExtService,
                ],
            };
        };
        return HelpExtModule;
    }());
    HelpExtModule.decorators = [
        { type: core.NgModule, args: [{
                    imports: [common.CommonModule, portal.PortalModule, overlay.OverlayModule],
                    declarations: [
                        HelpExtComponent,
                        HelpExtFlyoutComponent,
                        HelpExtArticleContentComponent,
                        HelpExtAttachmentComponent,
                        HelpExtUidDirective,
                    ],
                    exports: [HelpExtComponent, HelpExtArticleContentComponent, HelpExtAttachmentComponent, HelpExtUidDirective],
                    entryComponents: [HelpExtFlyoutComponent],
                },] }
    ];

    /*
     * Public API Surface of ngx-help-ext
     */

    /**
     * Generated bundle index. Do not edit.
     */

    exports.Article = Article;
    exports.Attachment = Attachment;
    exports.HELP_EXT_CACHE_LIFETIME_TOKEN = HELP_EXT_CACHE_LIFETIME_TOKEN;
    exports.HELP_EXT_HTTP_HEADERS = HELP_EXT_HTTP_HEADERS;
    exports.HELP_EXT_URL_TOKEN = HELP_EXT_URL_TOKEN;
    exports.HelpExtComponent = HelpExtComponent;
    exports.HelpExtModule = HelpExtModule;
    exports.HelpExtService = HelpExtService;
    exports.HelpExtUrlResolver = HelpExtUrlResolver;
    exports.ɵa = cacheLifetimeSecondDefault;
    exports.ɵb = HelpExtFlyoutComponent;
    exports.ɵc = helpExtFlyoutAnimations;
    exports.ɵd = HelpExtArticleContentComponent;
    exports.ɵe = HelpExtAttachmentComponent;
    exports.ɵf = HelpExtUidDirective;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=dintecom-ngx-help-ext.umd.js.map
