/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/mithril/api/mount-redraw.js":
/*!**************************************************!*\
  !*** ./node_modules/mithril/api/mount-redraw.js ***!
  \**************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")

module.exports = function(render, schedule, console) {
	var subscriptions = []
	var rendering = false
	var pending = false

	function sync() {
		if (rendering) throw new Error("Nested m.redraw.sync() call")
		rendering = true
		for (var i = 0; i < subscriptions.length; i += 2) {
			try { render(subscriptions[i], Vnode(subscriptions[i + 1]), redraw) }
			catch (e) { console.error(e) }
		}
		rendering = false
	}

	function redraw() {
		if (!pending) {
			pending = true
			schedule(function() {
				pending = false
				sync()
			})
		}
	}

	redraw.sync = sync

	function mount(root, component) {
		if (component != null && component.view == null && typeof component !== "function") {
			throw new TypeError("m.mount(element, component) expects a component, not a vnode")
		}

		var index = subscriptions.indexOf(root)
		if (index >= 0) {
			subscriptions.splice(index, 2)
			render(root, [], redraw)
		}

		if (component != null) {
			subscriptions.push(root, component)
			render(root, Vnode(component), redraw)
		}
	}

	return {mount: mount, redraw: redraw}
}


/***/ }),

/***/ "./node_modules/mithril/api/router.js":
/*!********************************************!*\
  !*** ./node_modules/mithril/api/router.js ***!
  \********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")
var m = __webpack_require__(/*! ../render/hyperscript */ "./node_modules/mithril/render/hyperscript.js")
var Promise = __webpack_require__(/*! ../promise/promise */ "./node_modules/mithril/promise/promise.js")

var buildPathname = __webpack_require__(/*! ../pathname/build */ "./node_modules/mithril/pathname/build.js")
var parsePathname = __webpack_require__(/*! ../pathname/parse */ "./node_modules/mithril/pathname/parse.js")
var compileTemplate = __webpack_require__(/*! ../pathname/compileTemplate */ "./node_modules/mithril/pathname/compileTemplate.js")
var assign = __webpack_require__(/*! ../pathname/assign */ "./node_modules/mithril/pathname/assign.js")

var sentinel = {}

module.exports = function($window, mountRedraw) {
	var fireAsync

	function setPath(path, data, options) {
		path = buildPathname(path, data)
		if (fireAsync != null) {
			fireAsync()
			var state = options ? options.state : null
			var title = options ? options.title : null
			if (options && options.replace) $window.history.replaceState(state, title, route.prefix + path)
			else $window.history.pushState(state, title, route.prefix + path)
		}
		else {
			$window.location.href = route.prefix + path
		}
	}

	var currentResolver = sentinel, component, attrs, currentPath, lastUpdate

	var SKIP = route.SKIP = {}

	function route(root, defaultRoute, routes) {
		if (root == null) throw new Error("Ensure the DOM element that was passed to `m.route` is not undefined")
		// 0 = start
		// 1 = init
		// 2 = ready
		var state = 0

		var compiled = Object.keys(routes).map(function(route) {
			if (route[0] !== "/") throw new SyntaxError("Routes must start with a `/`")
			if ((/:([^\/\.-]+)(\.{3})?:/).test(route)) {
				throw new SyntaxError("Route parameter names must be separated with either `/`, `.`, or `-`")
			}
			return {
				route: route,
				component: routes[route],
				check: compileTemplate(route),
			}
		})
		var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout
		var p = Promise.resolve()
		var scheduled = false
		var onremove

		fireAsync = null

		if (defaultRoute != null) {
			var defaultData = parsePathname(defaultRoute)

			if (!compiled.some(function (i) { return i.check(defaultData) })) {
				throw new ReferenceError("Default route doesn't match any known routes")
			}
		}

		function resolveRoute() {
			scheduled = false
			// Consider the pathname holistically. The prefix might even be invalid,
			// but that's not our problem.
			var prefix = $window.location.hash
			if (route.prefix[0] !== "#") {
				prefix = $window.location.search + prefix
				if (route.prefix[0] !== "?") {
					prefix = $window.location.pathname + prefix
					if (prefix[0] !== "/") prefix = "/" + prefix
				}
			}
			// This seemingly useless `.concat()` speeds up the tests quite a bit,
			// since the representation is consistently a relatively poorly
			// optimized cons string.
			var path = prefix.concat()
				.replace(/(?:%[a-f89][a-f0-9])+/gim, decodeURIComponent)
				.slice(route.prefix.length)
			var data = parsePathname(path)

			assign(data.params, $window.history.state)

			function fail() {
				if (path === defaultRoute) throw new Error("Could not resolve default route " + defaultRoute)
				setPath(defaultRoute, null, {replace: true})
			}

			loop(0)
			function loop(i) {
				// 0 = init
				// 1 = scheduled
				// 2 = done
				for (; i < compiled.length; i++) {
					if (compiled[i].check(data)) {
						var payload = compiled[i].component
						var matchedRoute = compiled[i].route
						var localComp = payload
						var update = lastUpdate = function(comp) {
							if (update !== lastUpdate) return
							if (comp === SKIP) return loop(i + 1)
							component = comp != null && (typeof comp.view === "function" || typeof comp === "function")? comp : "div"
							attrs = data.params, currentPath = path, lastUpdate = null
							currentResolver = payload.render ? payload : null
							if (state === 2) mountRedraw.redraw()
							else {
								state = 2
								mountRedraw.redraw.sync()
							}
						}
						// There's no understating how much I *wish* I could
						// use `async`/`await` here...
						if (payload.view || typeof payload === "function") {
							payload = {}
							update(localComp)
						}
						else if (payload.onmatch) {
							p.then(function () {
								return payload.onmatch(data.params, path, matchedRoute)
							}).then(update, fail)
						}
						else update("div")
						return
					}
				}
				fail()
			}
		}

		// Set it unconditionally so `m.route.set` and `m.route.Link` both work,
		// even if neither `pushState` nor `hashchange` are supported. It's
		// cleared if `hashchange` is used, since that makes it automatically
		// async.
		fireAsync = function() {
			if (!scheduled) {
				scheduled = true
				callAsync(resolveRoute)
			}
		}

		if (typeof $window.history.pushState === "function") {
			onremove = function() {
				$window.removeEventListener("popstate", fireAsync, false)
			}
			$window.addEventListener("popstate", fireAsync, false)
		} else if (route.prefix[0] === "#") {
			fireAsync = null
			onremove = function() {
				$window.removeEventListener("hashchange", resolveRoute, false)
			}
			$window.addEventListener("hashchange", resolveRoute, false)
		}

		return mountRedraw.mount(root, {
			onbeforeupdate: function() {
				state = state ? 2 : 1
				return !(!state || sentinel === currentResolver)
			},
			oncreate: resolveRoute,
			onremove: onremove,
			view: function() {
				if (!state || sentinel === currentResolver) return
				// Wrap in a fragment to preserve existing key semantics
				var vnode = [Vnode(component, attrs.key, attrs)]
				if (currentResolver) vnode = currentResolver.render(vnode[0])
				return vnode
			},
		})
	}
	route.set = function(path, data, options) {
		if (lastUpdate != null) {
			options = options || {}
			options.replace = true
		}
		lastUpdate = null
		setPath(path, data, options)
	}
	route.get = function() {return currentPath}
	route.prefix = "#!"
	route.Link = {
		view: function(vnode) {
			var options = vnode.attrs.options
			// Remove these so they don't get overwritten
			var attrs = {}, onclick, href
			assign(attrs, vnode.attrs)
			// The first two are internal, but the rest are magic attributes
			// that need censored to not screw up rendering.
			attrs.selector = attrs.options = attrs.key = attrs.oninit =
			attrs.oncreate = attrs.onbeforeupdate = attrs.onupdate =
			attrs.onbeforeremove = attrs.onremove = null

			// Do this now so we can get the most current `href` and `disabled`.
			// Those attributes may also be specified in the selector, and we
			// should honor that.
			var child = m(vnode.attrs.selector || "a", attrs, vnode.children)

			// Let's provide a *right* way to disable a route link, rather than
			// letting people screw up accessibility on accident.
			//
			// The attribute is coerced so users don't get surprised over
			// `disabled: 0` resulting in a button that's somehow routable
			// despite being visibly disabled.
			if (child.attrs.disabled = Boolean(child.attrs.disabled)) {
				child.attrs.href = null
				child.attrs["aria-disabled"] = "true"
				// If you *really* do want to do this on a disabled link, use
				// an `oncreate` hook to add it.
				child.attrs.onclick = null
			} else {
				onclick = child.attrs.onclick
				href = child.attrs.href
				child.attrs.href = route.prefix + href
				child.attrs.onclick = function(e) {
					var result
					if (typeof onclick === "function") {
						result = onclick.call(e.currentTarget, e)
					} else if (onclick == null || typeof onclick !== "object") {
						// do nothing
					} else if (typeof onclick.handleEvent === "function") {
						onclick.handleEvent(e)
					}

					// Adapted from React Router's implementation:
					// https://github.com/ReactTraining/react-router/blob/520a0acd48ae1b066eb0b07d6d4d1790a1d02482/packages/react-router-dom/modules/Link.js
					//
					// Try to be flexible and intuitive in how we handle links.
					// Fun fact: links aren't as obvious to get right as you
					// would expect. There's a lot more valid ways to click a
					// link than this, and one might want to not simply click a
					// link, but right click or command-click it to copy the
					// link target, etc. Nope, this isn't just for blind people.
					if (
						// Skip if `onclick` prevented default
						result !== false && !e.defaultPrevented &&
						// Ignore everything but left clicks
						(e.button === 0 || e.which === 0 || e.which === 1) &&
						// Let the browser handle `target=_blank`, etc.
						(!e.currentTarget.target || e.currentTarget.target === "_self") &&
						// No modifier keys
						!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
					) {
						e.preventDefault()
						e.redraw = false
						route.set(href, null, options)
					}
				}
			}
			return child
		},
	}
	route.param = function(key) {
		return attrs && key != null ? attrs[key] : attrs
	}

	return route
}


/***/ }),

/***/ "./node_modules/mithril/hyperscript.js":
/*!*********************************************!*\
  !*** ./node_modules/mithril/hyperscript.js ***!
  \*********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var hyperscript = __webpack_require__(/*! ./render/hyperscript */ "./node_modules/mithril/render/hyperscript.js")

hyperscript.trust = __webpack_require__(/*! ./render/trust */ "./node_modules/mithril/render/trust.js")
hyperscript.fragment = __webpack_require__(/*! ./render/fragment */ "./node_modules/mithril/render/fragment.js")

module.exports = hyperscript


/***/ }),

/***/ "./node_modules/mithril/index.js":
/*!***************************************!*\
  !*** ./node_modules/mithril/index.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var hyperscript = __webpack_require__(/*! ./hyperscript */ "./node_modules/mithril/hyperscript.js")
var request = __webpack_require__(/*! ./request */ "./node_modules/mithril/request.js")
var mountRedraw = __webpack_require__(/*! ./mount-redraw */ "./node_modules/mithril/mount-redraw.js")

var m = function m() { return hyperscript.apply(this, arguments) }
m.m = hyperscript
m.trust = hyperscript.trust
m.fragment = hyperscript.fragment
m.mount = mountRedraw.mount
m.route = __webpack_require__(/*! ./route */ "./node_modules/mithril/route.js")
m.render = __webpack_require__(/*! ./render */ "./node_modules/mithril/render.js")
m.redraw = mountRedraw.redraw
m.request = request.request
m.jsonp = request.jsonp
m.parseQueryString = __webpack_require__(/*! ./querystring/parse */ "./node_modules/mithril/querystring/parse.js")
m.buildQueryString = __webpack_require__(/*! ./querystring/build */ "./node_modules/mithril/querystring/build.js")
m.parsePathname = __webpack_require__(/*! ./pathname/parse */ "./node_modules/mithril/pathname/parse.js")
m.buildPathname = __webpack_require__(/*! ./pathname/build */ "./node_modules/mithril/pathname/build.js")
m.vnode = __webpack_require__(/*! ./render/vnode */ "./node_modules/mithril/render/vnode.js")
m.PromisePolyfill = __webpack_require__(/*! ./promise/polyfill */ "./node_modules/mithril/promise/polyfill.js")

module.exports = m


/***/ }),

/***/ "./node_modules/mithril/mount-redraw.js":
/*!**********************************************!*\
  !*** ./node_modules/mithril/mount-redraw.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var render = __webpack_require__(/*! ./render */ "./node_modules/mithril/render.js")

module.exports = __webpack_require__(/*! ./api/mount-redraw */ "./node_modules/mithril/api/mount-redraw.js")(render, requestAnimationFrame, console)


/***/ }),

/***/ "./node_modules/mithril/pathname/assign.js":
/*!*************************************************!*\
  !*** ./node_modules/mithril/pathname/assign.js ***!
  \*************************************************/
/***/ ((module) => {



module.exports = Object.assign || function(target, source) {
	if(source) Object.keys(source).forEach(function(key) { target[key] = source[key] })
}


/***/ }),

/***/ "./node_modules/mithril/pathname/build.js":
/*!************************************************!*\
  !*** ./node_modules/mithril/pathname/build.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var buildQueryString = __webpack_require__(/*! ../querystring/build */ "./node_modules/mithril/querystring/build.js")
var assign = __webpack_require__(/*! ./assign */ "./node_modules/mithril/pathname/assign.js")

// Returns `path` from `template` + `params`
module.exports = function(template, params) {
	if ((/:([^\/\.-]+)(\.{3})?:/).test(template)) {
		throw new SyntaxError("Template parameter names *must* be separated")
	}
	if (params == null) return template
	var queryIndex = template.indexOf("?")
	var hashIndex = template.indexOf("#")
	var queryEnd = hashIndex < 0 ? template.length : hashIndex
	var pathEnd = queryIndex < 0 ? queryEnd : queryIndex
	var path = template.slice(0, pathEnd)
	var query = {}

	assign(query, params)

	var resolved = path.replace(/:([^\/\.-]+)(\.{3})?/g, function(m, key, variadic) {
		delete query[key]
		// If no such parameter exists, don't interpolate it.
		if (params[key] == null) return m
		// Escape normal parameters, but not variadic ones.
		return variadic ? params[key] : encodeURIComponent(String(params[key]))
	})

	// In case the template substitution adds new query/hash parameters.
	var newQueryIndex = resolved.indexOf("?")
	var newHashIndex = resolved.indexOf("#")
	var newQueryEnd = newHashIndex < 0 ? resolved.length : newHashIndex
	var newPathEnd = newQueryIndex < 0 ? newQueryEnd : newQueryIndex
	var result = resolved.slice(0, newPathEnd)

	if (queryIndex >= 0) result += template.slice(queryIndex, queryEnd)
	if (newQueryIndex >= 0) result += (queryIndex < 0 ? "?" : "&") + resolved.slice(newQueryIndex, newQueryEnd)
	var querystring = buildQueryString(query)
	if (querystring) result += (queryIndex < 0 && newQueryIndex < 0 ? "?" : "&") + querystring
	if (hashIndex >= 0) result += template.slice(hashIndex)
	if (newHashIndex >= 0) result += (hashIndex < 0 ? "" : "&") + resolved.slice(newHashIndex)
	return result
}


/***/ }),

/***/ "./node_modules/mithril/pathname/compileTemplate.js":
/*!**********************************************************!*\
  !*** ./node_modules/mithril/pathname/compileTemplate.js ***!
  \**********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var parsePathname = __webpack_require__(/*! ./parse */ "./node_modules/mithril/pathname/parse.js")

// Compiles a template into a function that takes a resolved path (without query
// strings) and returns an object containing the template parameters with their
// parsed values. This expects the input of the compiled template to be the
// output of `parsePathname`. Note that it does *not* remove query parameters
// specified in the template.
module.exports = function(template) {
	var templateData = parsePathname(template)
	var templateKeys = Object.keys(templateData.params)
	var keys = []
	var regexp = new RegExp("^" + templateData.path.replace(
		// I escape literal text so people can use things like `:file.:ext` or
		// `:lang-:locale` in routes. This is all merged into one pass so I
		// don't also accidentally escape `-` and make it harder to detect it to
		// ban it from template parameters.
		/:([^\/.-]+)(\.{3}|\.(?!\.)|-)?|[\\^$*+.()|\[\]{}]/g,
		function(m, key, extra) {
			if (key == null) return "\\" + m
			keys.push({k: key, r: extra === "..."})
			if (extra === "...") return "(.*)"
			if (extra === ".") return "([^/]+)\\."
			return "([^/]+)" + (extra || "")
		}
	) + "$")
	return function(data) {
		// First, check the params. Usually, there isn't any, and it's just
		// checking a static set.
		for (var i = 0; i < templateKeys.length; i++) {
			if (templateData.params[templateKeys[i]] !== data.params[templateKeys[i]]) return false
		}
		// If no interpolations exist, let's skip all the ceremony
		if (!keys.length) return regexp.test(data.path)
		var values = regexp.exec(data.path)
		if (values == null) return false
		for (var i = 0; i < keys.length; i++) {
			data.params[keys[i].k] = keys[i].r ? values[i + 1] : decodeURIComponent(values[i + 1])
		}
		return true
	}
}


/***/ }),

/***/ "./node_modules/mithril/pathname/parse.js":
/*!************************************************!*\
  !*** ./node_modules/mithril/pathname/parse.js ***!
  \************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var parseQueryString = __webpack_require__(/*! ../querystring/parse */ "./node_modules/mithril/querystring/parse.js")

// Returns `{path, params}` from `url`
module.exports = function(url) {
	var queryIndex = url.indexOf("?")
	var hashIndex = url.indexOf("#")
	var queryEnd = hashIndex < 0 ? url.length : hashIndex
	var pathEnd = queryIndex < 0 ? queryEnd : queryIndex
	var path = url.slice(0, pathEnd).replace(/\/{2,}/g, "/")

	if (!path) path = "/"
	else {
		if (path[0] !== "/") path = "/" + path
		if (path.length > 1 && path[path.length - 1] === "/") path = path.slice(0, -1)
	}
	return {
		path: path,
		params: queryIndex < 0
			? {}
			: parseQueryString(url.slice(queryIndex + 1, queryEnd)),
	}
}


/***/ }),

/***/ "./node_modules/mithril/promise/polyfill.js":
/*!**************************************************!*\
  !*** ./node_modules/mithril/promise/polyfill.js ***!
  \**************************************************/
/***/ ((module) => {


/** @constructor */
var PromisePolyfill = function(executor) {
	if (!(this instanceof PromisePolyfill)) throw new Error("Promise must be called with `new`")
	if (typeof executor !== "function") throw new TypeError("executor must be a function")

	var self = this, resolvers = [], rejectors = [], resolveCurrent = handler(resolvers, true), rejectCurrent = handler(rejectors, false)
	var instance = self._instance = {resolvers: resolvers, rejectors: rejectors}
	var callAsync = typeof setImmediate === "function" ? setImmediate : setTimeout
	function handler(list, shouldAbsorb) {
		return function execute(value) {
			var then
			try {
				if (shouldAbsorb && value != null && (typeof value === "object" || typeof value === "function") && typeof (then = value.then) === "function") {
					if (value === self) throw new TypeError("Promise can't be resolved w/ itself")
					executeOnce(then.bind(value))
				}
				else {
					callAsync(function() {
						if (!shouldAbsorb && list.length === 0) console.error("Possible unhandled promise rejection:", value)
						for (var i = 0; i < list.length; i++) list[i](value)
						resolvers.length = 0, rejectors.length = 0
						instance.state = shouldAbsorb
						instance.retry = function() {execute(value)}
					})
				}
			}
			catch (e) {
				rejectCurrent(e)
			}
		}
	}
	function executeOnce(then) {
		var runs = 0
		function run(fn) {
			return function(value) {
				if (runs++ > 0) return
				fn(value)
			}
		}
		var onerror = run(rejectCurrent)
		try {then(run(resolveCurrent), onerror)} catch (e) {onerror(e)}
	}

	executeOnce(executor)
}
PromisePolyfill.prototype.then = function(onFulfilled, onRejection) {
	var self = this, instance = self._instance
	function handle(callback, list, next, state) {
		list.push(function(value) {
			if (typeof callback !== "function") next(value)
			else try {resolveNext(callback(value))} catch (e) {if (rejectNext) rejectNext(e)}
		})
		if (typeof instance.retry === "function" && state === instance.state) instance.retry()
	}
	var resolveNext, rejectNext
	var promise = new PromisePolyfill(function(resolve, reject) {resolveNext = resolve, rejectNext = reject})
	handle(onFulfilled, instance.resolvers, resolveNext, true), handle(onRejection, instance.rejectors, rejectNext, false)
	return promise
}
PromisePolyfill.prototype.catch = function(onRejection) {
	return this.then(null, onRejection)
}
PromisePolyfill.prototype.finally = function(callback) {
	return this.then(
		function(value) {
			return PromisePolyfill.resolve(callback()).then(function() {
				return value
			})
		},
		function(reason) {
			return PromisePolyfill.resolve(callback()).then(function() {
				return PromisePolyfill.reject(reason);
			})
		}
	)
}
PromisePolyfill.resolve = function(value) {
	if (value instanceof PromisePolyfill) return value
	return new PromisePolyfill(function(resolve) {resolve(value)})
}
PromisePolyfill.reject = function(value) {
	return new PromisePolyfill(function(resolve, reject) {reject(value)})
}
PromisePolyfill.all = function(list) {
	return new PromisePolyfill(function(resolve, reject) {
		var total = list.length, count = 0, values = []
		if (list.length === 0) resolve([])
		else for (var i = 0; i < list.length; i++) {
			(function(i) {
				function consume(value) {
					count++
					values[i] = value
					if (count === total) resolve(values)
				}
				if (list[i] != null && (typeof list[i] === "object" || typeof list[i] === "function") && typeof list[i].then === "function") {
					list[i].then(consume, reject)
				}
				else consume(list[i])
			})(i)
		}
	})
}
PromisePolyfill.race = function(list) {
	return new PromisePolyfill(function(resolve, reject) {
		for (var i = 0; i < list.length; i++) {
			list[i].then(resolve, reject)
		}
	})
}

module.exports = PromisePolyfill


/***/ }),

/***/ "./node_modules/mithril/promise/promise.js":
/*!*************************************************!*\
  !*** ./node_modules/mithril/promise/promise.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var PromisePolyfill = __webpack_require__(/*! ./polyfill */ "./node_modules/mithril/promise/polyfill.js")

if (typeof window !== "undefined") {
	if (typeof window.Promise === "undefined") {
		window.Promise = PromisePolyfill
	} else if (!window.Promise.prototype.finally) {
		window.Promise.prototype.finally = PromisePolyfill.prototype.finally
	}
	module.exports = window.Promise
} else if (typeof __webpack_require__.g !== "undefined") {
	if (typeof __webpack_require__.g.Promise === "undefined") {
		__webpack_require__.g.Promise = PromisePolyfill
	} else if (!__webpack_require__.g.Promise.prototype.finally) {
		__webpack_require__.g.Promise.prototype.finally = PromisePolyfill.prototype.finally
	}
	module.exports = __webpack_require__.g.Promise
} else {
	module.exports = PromisePolyfill
}


/***/ }),

/***/ "./node_modules/mithril/querystring/build.js":
/*!***************************************************!*\
  !*** ./node_modules/mithril/querystring/build.js ***!
  \***************************************************/
/***/ ((module) => {



module.exports = function(object) {
	if (Object.prototype.toString.call(object) !== "[object Object]") return ""

	var args = []
	for (var key in object) {
		destructure(key, object[key])
	}

	return args.join("&")

	function destructure(key, value) {
		if (Array.isArray(value)) {
			for (var i = 0; i < value.length; i++) {
				destructure(key + "[" + i + "]", value[i])
			}
		}
		else if (Object.prototype.toString.call(value) === "[object Object]") {
			for (var i in value) {
				destructure(key + "[" + i + "]", value[i])
			}
		}
		else args.push(encodeURIComponent(key) + (value != null && value !== "" ? "=" + encodeURIComponent(value) : ""))
	}
}


/***/ }),

/***/ "./node_modules/mithril/querystring/parse.js":
/*!***************************************************!*\
  !*** ./node_modules/mithril/querystring/parse.js ***!
  \***************************************************/
/***/ ((module) => {



module.exports = function(string) {
	if (string === "" || string == null) return {}
	if (string.charAt(0) === "?") string = string.slice(1)

	var entries = string.split("&"), counters = {}, data = {}
	for (var i = 0; i < entries.length; i++) {
		var entry = entries[i].split("=")
		var key = decodeURIComponent(entry[0])
		var value = entry.length === 2 ? decodeURIComponent(entry[1]) : ""

		if (value === "true") value = true
		else if (value === "false") value = false

		var levels = key.split(/\]\[?|\[/)
		var cursor = data
		if (key.indexOf("[") > -1) levels.pop()
		for (var j = 0; j < levels.length; j++) {
			var level = levels[j], nextLevel = levels[j + 1]
			var isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10))
			if (level === "") {
				var key = levels.slice(0, j).join()
				if (counters[key] == null) {
					counters[key] = Array.isArray(cursor) ? cursor.length : 0
				}
				level = counters[key]++
			}
			// Disallow direct prototype pollution
			else if (level === "__proto__") break
			if (j === levels.length - 1) cursor[level] = value
			else {
				// Read own properties exclusively to disallow indirect
				// prototype pollution
				var desc = Object.getOwnPropertyDescriptor(cursor, level)
				if (desc != null) desc = desc.value
				if (desc == null) cursor[level] = desc = isNumber ? [] : {}
				cursor = desc
			}
		}
	}
	return data
}


/***/ }),

/***/ "./node_modules/mithril/render.js":
/*!****************************************!*\
  !*** ./node_modules/mithril/render.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



module.exports = __webpack_require__(/*! ./render/render */ "./node_modules/mithril/render/render.js")(window)


/***/ }),

/***/ "./node_modules/mithril/render/fragment.js":
/*!*************************************************!*\
  !*** ./node_modules/mithril/render/fragment.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")
var hyperscriptVnode = __webpack_require__(/*! ./hyperscriptVnode */ "./node_modules/mithril/render/hyperscriptVnode.js")

module.exports = function() {
	var vnode = hyperscriptVnode.apply(0, arguments)

	vnode.tag = "["
	vnode.children = Vnode.normalizeChildren(vnode.children)
	return vnode
}


/***/ }),

/***/ "./node_modules/mithril/render/hyperscript.js":
/*!****************************************************!*\
  !*** ./node_modules/mithril/render/hyperscript.js ***!
  \****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")
var hyperscriptVnode = __webpack_require__(/*! ./hyperscriptVnode */ "./node_modules/mithril/render/hyperscriptVnode.js")

var selectorParser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[(.+?)(?:\s*=\s*("|'|)((?:\\["'\]]|.)*?)\5)?\])/g
var selectorCache = {}
var hasOwn = {}.hasOwnProperty

function isEmpty(object) {
	for (var key in object) if (hasOwn.call(object, key)) return false
	return true
}

function compileSelector(selector) {
	var match, tag = "div", classes = [], attrs = {}
	while (match = selectorParser.exec(selector)) {
		var type = match[1], value = match[2]
		if (type === "" && value !== "") tag = value
		else if (type === "#") attrs.id = value
		else if (type === ".") classes.push(value)
		else if (match[3][0] === "[") {
			var attrValue = match[6]
			if (attrValue) attrValue = attrValue.replace(/\\(["'])/g, "$1").replace(/\\\\/g, "\\")
			if (match[4] === "class") classes.push(attrValue)
			else attrs[match[4]] = attrValue === "" ? attrValue : attrValue || true
		}
	}
	if (classes.length > 0) attrs.className = classes.join(" ")
	return selectorCache[selector] = {tag: tag, attrs: attrs}
}

function execSelector(state, vnode) {
	var attrs = vnode.attrs
	var children = Vnode.normalizeChildren(vnode.children)
	var hasClass = hasOwn.call(attrs, "class")
	var className = hasClass ? attrs.class : attrs.className

	vnode.tag = state.tag
	vnode.attrs = null
	vnode.children = undefined

	if (!isEmpty(state.attrs) && !isEmpty(attrs)) {
		var newAttrs = {}

		for (var key in attrs) {
			if (hasOwn.call(attrs, key)) newAttrs[key] = attrs[key]
		}

		attrs = newAttrs
	}

	for (var key in state.attrs) {
		if (hasOwn.call(state.attrs, key) && key !== "className" && !hasOwn.call(attrs, key)){
			attrs[key] = state.attrs[key]
		}
	}
	if (className != null || state.attrs.className != null) attrs.className =
		className != null
			? state.attrs.className != null
				? String(state.attrs.className) + " " + String(className)
				: className
			: state.attrs.className != null
				? state.attrs.className
				: null

	if (hasClass) attrs.class = null

	for (var key in attrs) {
		if (hasOwn.call(attrs, key) && key !== "key") {
			vnode.attrs = attrs
			break
		}
	}

	if (Array.isArray(children) && children.length === 1 && children[0] != null && children[0].tag === "#") {
		vnode.text = children[0].children
	} else {
		vnode.children = children
	}

	return vnode
}

function hyperscript(selector) {
	if (selector == null || typeof selector !== "string" && typeof selector !== "function" && typeof selector.view !== "function") {
		throw Error("The selector must be either a string or a component.");
	}

	var vnode = hyperscriptVnode.apply(1, arguments)

	if (typeof selector === "string") {
		vnode.children = Vnode.normalizeChildren(vnode.children)
		if (selector !== "[") return execSelector(selectorCache[selector] || compileSelector(selector), vnode)
	}

	vnode.tag = selector
	return vnode
}

module.exports = hyperscript


/***/ }),

/***/ "./node_modules/mithril/render/hyperscriptVnode.js":
/*!*********************************************************!*\
  !*** ./node_modules/mithril/render/hyperscriptVnode.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")

// Call via `hyperscriptVnode.apply(startOffset, arguments)`
//
// The reason I do it this way, forwarding the arguments and passing the start
// offset in `this`, is so I don't have to create a temporary array in a
// performance-critical path.
//
// In native ES6, I'd instead add a final `...args` parameter to the
// `hyperscript` and `fragment` factories and define this as
// `hyperscriptVnode(...args)`, since modern engines do optimize that away. But
// ES5 (what Mithril requires thanks to IE support) doesn't give me that luxury,
// and engines aren't nearly intelligent enough to do either of these:
//
// 1. Elide the allocation for `[].slice.call(arguments, 1)` when it's passed to
//    another function only to be indexed.
// 2. Elide an `arguments` allocation when it's passed to any function other
//    than `Function.prototype.apply` or `Reflect.apply`.
//
// In ES6, it'd probably look closer to this (I'd need to profile it, though):
// module.exports = function(attrs, ...children) {
//     if (attrs == null || typeof attrs === "object" && attrs.tag == null && !Array.isArray(attrs)) {
//         if (children.length === 1 && Array.isArray(children[0])) children = children[0]
//     } else {
//         children = children.length === 0 && Array.isArray(attrs) ? attrs : [attrs, ...children]
//         attrs = undefined
//     }
//
//     if (attrs == null) attrs = {}
//     return Vnode("", attrs.key, attrs, children)
// }
module.exports = function() {
	var attrs = arguments[this], start = this + 1, children

	if (attrs == null) {
		attrs = {}
	} else if (typeof attrs !== "object" || attrs.tag != null || Array.isArray(attrs)) {
		attrs = {}
		start = this
	}

	if (arguments.length === start + 1) {
		children = arguments[start]
		if (!Array.isArray(children)) children = [children]
	} else {
		children = []
		while (start < arguments.length) children.push(arguments[start++])
	}

	return Vnode("", attrs.key, attrs, children)
}


/***/ }),

/***/ "./node_modules/mithril/render/render.js":
/*!***********************************************!*\
  !*** ./node_modules/mithril/render/render.js ***!
  \***********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")

module.exports = function($window) {
	var $doc = $window && $window.document
	var currentRedraw

	var nameSpace = {
		svg: "http://www.w3.org/2000/svg",
		math: "http://www.w3.org/1998/Math/MathML"
	}

	function getNameSpace(vnode) {
		return vnode.attrs && vnode.attrs.xmlns || nameSpace[vnode.tag]
	}

	//sanity check to discourage people from doing `vnode.state = ...`
	function checkState(vnode, original) {
		if (vnode.state !== original) throw new Error("`vnode.state` must not be modified")
	}

	//Note: the hook is passed as the `this` argument to allow proxying the
	//arguments without requiring a full array allocation to do so. It also
	//takes advantage of the fact the current `vnode` is the first argument in
	//all lifecycle methods.
	function callHook(vnode) {
		var original = vnode.state
		try {
			return this.apply(original, arguments)
		} finally {
			checkState(vnode, original)
		}
	}

	// IE11 (at least) throws an UnspecifiedError when accessing document.activeElement when
	// inside an iframe. Catch and swallow this error, and heavy-handidly return null.
	function activeElement() {
		try {
			return $doc.activeElement
		} catch (e) {
			return null
		}
	}
	//create
	function createNodes(parent, vnodes, start, end, hooks, nextSibling, ns) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i]
			if (vnode != null) {
				createNode(parent, vnode, hooks, ns, nextSibling)
			}
		}
	}
	function createNode(parent, vnode, hooks, ns, nextSibling) {
		var tag = vnode.tag
		if (typeof tag === "string") {
			vnode.state = {}
			if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks)
			switch (tag) {
				case "#": createText(parent, vnode, nextSibling); break
				case "<": createHTML(parent, vnode, ns, nextSibling); break
				case "[": createFragment(parent, vnode, hooks, ns, nextSibling); break
				default: createElement(parent, vnode, hooks, ns, nextSibling)
			}
		}
		else createComponent(parent, vnode, hooks, ns, nextSibling)
	}
	function createText(parent, vnode, nextSibling) {
		vnode.dom = $doc.createTextNode(vnode.children)
		insertNode(parent, vnode.dom, nextSibling)
	}
	var possibleParents = {caption: "table", thead: "table", tbody: "table", tfoot: "table", tr: "tbody", th: "tr", td: "tr", colgroup: "table", col: "colgroup"}
	function createHTML(parent, vnode, ns, nextSibling) {
		var match = vnode.children.match(/^\s*?<(\w+)/im) || []
		// not using the proper parent makes the child element(s) vanish.
		//     var div = document.createElement("div")
		//     div.innerHTML = "<td>i</td><td>j</td>"
		//     console.log(div.innerHTML)
		// --> "ij", no <td> in sight.
		var temp = $doc.createElement(possibleParents[match[1]] || "div")
		if (ns === "http://www.w3.org/2000/svg") {
			temp.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\">" + vnode.children + "</svg>"
			temp = temp.firstChild
		} else {
			temp.innerHTML = vnode.children
		}
		vnode.dom = temp.firstChild
		vnode.domSize = temp.childNodes.length
		// Capture nodes to remove, so we don't confuse them.
		vnode.instance = []
		var fragment = $doc.createDocumentFragment()
		var child
		while (child = temp.firstChild) {
			vnode.instance.push(child)
			fragment.appendChild(child)
		}
		insertNode(parent, fragment, nextSibling)
	}
	function createFragment(parent, vnode, hooks, ns, nextSibling) {
		var fragment = $doc.createDocumentFragment()
		if (vnode.children != null) {
			var children = vnode.children
			createNodes(fragment, children, 0, children.length, hooks, null, ns)
		}
		vnode.dom = fragment.firstChild
		vnode.domSize = fragment.childNodes.length
		insertNode(parent, fragment, nextSibling)
	}
	function createElement(parent, vnode, hooks, ns, nextSibling) {
		var tag = vnode.tag
		var attrs = vnode.attrs
		var is = attrs && attrs.is

		ns = getNameSpace(vnode) || ns

		var element = ns ?
			is ? $doc.createElementNS(ns, tag, {is: is}) : $doc.createElementNS(ns, tag) :
			is ? $doc.createElement(tag, {is: is}) : $doc.createElement(tag)
		vnode.dom = element

		if (attrs != null) {
			setAttrs(vnode, attrs, ns)
		}

		insertNode(parent, element, nextSibling)

		if (!maybeSetContentEditable(vnode)) {
			if (vnode.text != null) {
				if (vnode.text !== "") element.textContent = vnode.text
				else vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]
			}
			if (vnode.children != null) {
				var children = vnode.children
				createNodes(element, children, 0, children.length, hooks, null, ns)
				if (vnode.tag === "select" && attrs != null) setLateSelectAttrs(vnode, attrs)
			}
		}
	}
	function initComponent(vnode, hooks) {
		var sentinel
		if (typeof vnode.tag.view === "function") {
			vnode.state = Object.create(vnode.tag)
			sentinel = vnode.state.view
			if (sentinel.$$reentrantLock$$ != null) return
			sentinel.$$reentrantLock$$ = true
		} else {
			vnode.state = void 0
			sentinel = vnode.tag
			if (sentinel.$$reentrantLock$$ != null) return
			sentinel.$$reentrantLock$$ = true
			vnode.state = (vnode.tag.prototype != null && typeof vnode.tag.prototype.view === "function") ? new vnode.tag(vnode) : vnode.tag(vnode)
		}
		initLifecycle(vnode.state, vnode, hooks)
		if (vnode.attrs != null) initLifecycle(vnode.attrs, vnode, hooks)
		vnode.instance = Vnode.normalize(callHook.call(vnode.state.view, vnode))
		if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument")
		sentinel.$$reentrantLock$$ = null
	}
	function createComponent(parent, vnode, hooks, ns, nextSibling) {
		initComponent(vnode, hooks)
		if (vnode.instance != null) {
			createNode(parent, vnode.instance, hooks, ns, nextSibling)
			vnode.dom = vnode.instance.dom
			vnode.domSize = vnode.dom != null ? vnode.instance.domSize : 0
		}
		else {
			vnode.domSize = 0
		}
	}

	//update
	/**
	 * @param {Element|Fragment} parent - the parent element
	 * @param {Vnode[] | null} old - the list of vnodes of the last `render()` call for
	 *                               this part of the tree
	 * @param {Vnode[] | null} vnodes - as above, but for the current `render()` call.
	 * @param {Function[]} hooks - an accumulator of post-render hooks (oncreate/onupdate)
	 * @param {Element | null} nextSibling - the next DOM node if we're dealing with a
	 *                                       fragment that is not the last item in its
	 *                                       parent
	 * @param {'svg' | 'math' | String | null} ns) - the current XML namespace, if any
	 * @returns void
	 */
	// This function diffs and patches lists of vnodes, both keyed and unkeyed.
	//
	// We will:
	//
	// 1. describe its general structure
	// 2. focus on the diff algorithm optimizations
	// 3. discuss DOM node operations.

	// ## Overview:
	//
	// The updateNodes() function:
	// - deals with trivial cases
	// - determines whether the lists are keyed or unkeyed based on the first non-null node
	//   of each list.
	// - diffs them and patches the DOM if needed (that's the brunt of the code)
	// - manages the leftovers: after diffing, are there:
	//   - old nodes left to remove?
	// 	 - new nodes to insert?
	// 	 deal with them!
	//
	// The lists are only iterated over once, with an exception for the nodes in `old` that
	// are visited in the fourth part of the diff and in the `removeNodes` loop.

	// ## Diffing
	//
	// Reading https://github.com/localvoid/ivi/blob/ddc09d06abaef45248e6133f7040d00d3c6be853/packages/ivi/src/vdom/implementation.ts#L617-L837
	// may be good for context on longest increasing subsequence-based logic for moving nodes.
	//
	// In order to diff keyed lists, one has to
	//
	// 1) match nodes in both lists, per key, and update them accordingly
	// 2) create the nodes present in the new list, but absent in the old one
	// 3) remove the nodes present in the old list, but absent in the new one
	// 4) figure out what nodes in 1) to move in order to minimize the DOM operations.
	//
	// To achieve 1) one can create a dictionary of keys => index (for the old list), then iterate
	// over the new list and for each new vnode, find the corresponding vnode in the old list using
	// the map.
	// 2) is achieved in the same step: if a new node has no corresponding entry in the map, it is new
	// and must be created.
	// For the removals, we actually remove the nodes that have been updated from the old list.
	// The nodes that remain in that list after 1) and 2) have been performed can be safely removed.
	// The fourth step is a bit more complex and relies on the longest increasing subsequence (LIS)
	// algorithm.
	//
	// the longest increasing subsequence is the list of nodes that can remain in place. Imagine going
	// from `1,2,3,4,5` to `4,5,1,2,3` where the numbers are not necessarily the keys, but the indices
	// corresponding to the keyed nodes in the old list (keyed nodes `e,d,c,b,a` => `b,a,e,d,c` would
	//  match the above lists, for example).
	//
	// In there are two increasing subsequences: `4,5` and `1,2,3`, the latter being the longest. We
	// can update those nodes without moving them, and only call `insertNode` on `4` and `5`.
	//
	// @localvoid adapted the algo to also support node deletions and insertions (the `lis` is actually
	// the longest increasing subsequence *of old nodes still present in the new list*).
	//
	// It is a general algorithm that is fireproof in all circumstances, but it requires the allocation
	// and the construction of a `key => oldIndex` map, and three arrays (one with `newIndex => oldIndex`,
	// the `LIS` and a temporary one to create the LIS).
	//
	// So we cheat where we can: if the tails of the lists are identical, they are guaranteed to be part of
	// the LIS and can be updated without moving them.
	//
	// If two nodes are swapped, they are guaranteed not to be part of the LIS, and must be moved (with
	// the exception of the last node if the list is fully reversed).
	//
	// ## Finding the next sibling.
	//
	// `updateNode()` and `createNode()` expect a nextSibling parameter to perform DOM operations.
	// When the list is being traversed top-down, at any index, the DOM nodes up to the previous
	// vnode reflect the content of the new list, whereas the rest of the DOM nodes reflect the old
	// list. The next sibling must be looked for in the old list using `getNextSibling(... oldStart + 1 ...)`.
	//
	// In the other scenarios (swaps, upwards traversal, map-based diff),
	// the new vnodes list is traversed upwards. The DOM nodes at the bottom of the list reflect the
	// bottom part of the new vnodes list, and we can use the `v.dom`  value of the previous node
	// as the next sibling (cached in the `nextSibling` variable).


	// ## DOM node moves
	//
	// In most scenarios `updateNode()` and `createNode()` perform the DOM operations. However,
	// this is not the case if the node moved (second and fourth part of the diff algo). We move
	// the old DOM nodes before updateNode runs because it enables us to use the cached `nextSibling`
	// variable rather than fetching it using `getNextSibling()`.
	//
	// The fourth part of the diff currently inserts nodes unconditionally, leading to issues
	// like #1791 and #1999. We need to be smarter about those situations where adjascent old
	// nodes remain together in the new list in a way that isn't covered by parts one and
	// three of the diff algo.

	function updateNodes(parent, old, vnodes, hooks, nextSibling, ns) {
		if (old === vnodes || old == null && vnodes == null) return
		else if (old == null || old.length === 0) createNodes(parent, vnodes, 0, vnodes.length, hooks, nextSibling, ns)
		else if (vnodes == null || vnodes.length === 0) removeNodes(parent, old, 0, old.length)
		else {
			var isOldKeyed = old[0] != null && old[0].key != null
			var isKeyed = vnodes[0] != null && vnodes[0].key != null
			var start = 0, oldStart = 0
			if (!isOldKeyed) while (oldStart < old.length && old[oldStart] == null) oldStart++
			if (!isKeyed) while (start < vnodes.length && vnodes[start] == null) start++
			if (isKeyed === null && isOldKeyed == null) return // both lists are full of nulls
			if (isOldKeyed !== isKeyed) {
				removeNodes(parent, old, oldStart, old.length)
				createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns)
			} else if (!isKeyed) {
				// Don't index past the end of either list (causes deopts).
				var commonLength = old.length < vnodes.length ? old.length : vnodes.length
				// Rewind if necessary to the first non-null index on either side.
				// We could alternatively either explicitly create or remove nodes when `start !== oldStart`
				// but that would be optimizing for sparse lists which are more rare than dense ones.
				start = start < oldStart ? start : oldStart
				for (; start < commonLength; start++) {
					o = old[start]
					v = vnodes[start]
					if (o === v || o == null && v == null) continue
					else if (o == null) createNode(parent, v, hooks, ns, getNextSibling(old, start + 1, nextSibling))
					else if (v == null) removeNode(parent, o)
					else updateNode(parent, o, v, hooks, getNextSibling(old, start + 1, nextSibling), ns)
				}
				if (old.length > commonLength) removeNodes(parent, old, start, old.length)
				if (vnodes.length > commonLength) createNodes(parent, vnodes, start, vnodes.length, hooks, nextSibling, ns)
			} else {
				// keyed diff
				var oldEnd = old.length - 1, end = vnodes.length - 1, map, o, v, oe, ve, topSibling

				// bottom-up
				while (oldEnd >= oldStart && end >= start) {
					oe = old[oldEnd]
					ve = vnodes[end]
					if (oe.key !== ve.key) break
					if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns)
					if (ve.dom != null) nextSibling = ve.dom
					oldEnd--, end--
				}
				// top-down
				while (oldEnd >= oldStart && end >= start) {
					o = old[oldStart]
					v = vnodes[start]
					if (o.key !== v.key) break
					oldStart++, start++
					if (o !== v) updateNode(parent, o, v, hooks, getNextSibling(old, oldStart, nextSibling), ns)
				}
				// swaps and list reversals
				while (oldEnd >= oldStart && end >= start) {
					if (start === end) break
					if (o.key !== ve.key || oe.key !== v.key) break
					topSibling = getNextSibling(old, oldStart, nextSibling)
					moveNodes(parent, oe, topSibling)
					if (oe !== v) updateNode(parent, oe, v, hooks, topSibling, ns)
					if (++start <= --end) moveNodes(parent, o, nextSibling)
					if (o !== ve) updateNode(parent, o, ve, hooks, nextSibling, ns)
					if (ve.dom != null) nextSibling = ve.dom
					oldStart++; oldEnd--
					oe = old[oldEnd]
					ve = vnodes[end]
					o = old[oldStart]
					v = vnodes[start]
				}
				// bottom up once again
				while (oldEnd >= oldStart && end >= start) {
					if (oe.key !== ve.key) break
					if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns)
					if (ve.dom != null) nextSibling = ve.dom
					oldEnd--, end--
					oe = old[oldEnd]
					ve = vnodes[end]
				}
				if (start > end) removeNodes(parent, old, oldStart, oldEnd + 1)
				else if (oldStart > oldEnd) createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns)
				else {
					// inspired by ivi https://github.com/ivijs/ivi/ by Boris Kaul
					var originalNextSibling = nextSibling, vnodesLength = end - start + 1, oldIndices = new Array(vnodesLength), li=0, i=0, pos = 2147483647, matched = 0, map, lisIndices
					for (i = 0; i < vnodesLength; i++) oldIndices[i] = -1
					for (i = end; i >= start; i--) {
						if (map == null) map = getKeyMap(old, oldStart, oldEnd + 1)
						ve = vnodes[i]
						var oldIndex = map[ve.key]
						if (oldIndex != null) {
							pos = (oldIndex < pos) ? oldIndex : -1 // becomes -1 if nodes were re-ordered
							oldIndices[i-start] = oldIndex
							oe = old[oldIndex]
							old[oldIndex] = null
							if (oe !== ve) updateNode(parent, oe, ve, hooks, nextSibling, ns)
							if (ve.dom != null) nextSibling = ve.dom
							matched++
						}
					}
					nextSibling = originalNextSibling
					if (matched !== oldEnd - oldStart + 1) removeNodes(parent, old, oldStart, oldEnd + 1)
					if (matched === 0) createNodes(parent, vnodes, start, end + 1, hooks, nextSibling, ns)
					else {
						if (pos === -1) {
							// the indices of the indices of the items that are part of the
							// longest increasing subsequence in the oldIndices list
							lisIndices = makeLisIndices(oldIndices)
							li = lisIndices.length - 1
							for (i = end; i >= start; i--) {
								v = vnodes[i]
								if (oldIndices[i-start] === -1) createNode(parent, v, hooks, ns, nextSibling)
								else {
									if (lisIndices[li] === i - start) li--
									else moveNodes(parent, v, nextSibling)
								}
								if (v.dom != null) nextSibling = vnodes[i].dom
							}
						} else {
							for (i = end; i >= start; i--) {
								v = vnodes[i]
								if (oldIndices[i-start] === -1) createNode(parent, v, hooks, ns, nextSibling)
								if (v.dom != null) nextSibling = vnodes[i].dom
							}
						}
					}
				}
			}
		}
	}
	function updateNode(parent, old, vnode, hooks, nextSibling, ns) {
		var oldTag = old.tag, tag = vnode.tag
		if (oldTag === tag) {
			vnode.state = old.state
			vnode.events = old.events
			if (shouldNotUpdate(vnode, old)) return
			if (typeof oldTag === "string") {
				if (vnode.attrs != null) {
					updateLifecycle(vnode.attrs, vnode, hooks)
				}
				switch (oldTag) {
					case "#": updateText(old, vnode); break
					case "<": updateHTML(parent, old, vnode, ns, nextSibling); break
					case "[": updateFragment(parent, old, vnode, hooks, nextSibling, ns); break
					default: updateElement(old, vnode, hooks, ns)
				}
			}
			else updateComponent(parent, old, vnode, hooks, nextSibling, ns)
		}
		else {
			removeNode(parent, old)
			createNode(parent, vnode, hooks, ns, nextSibling)
		}
	}
	function updateText(old, vnode) {
		if (old.children.toString() !== vnode.children.toString()) {
			old.dom.nodeValue = vnode.children
		}
		vnode.dom = old.dom
	}
	function updateHTML(parent, old, vnode, ns, nextSibling) {
		if (old.children !== vnode.children) {
			removeHTML(parent, old)
			createHTML(parent, vnode, ns, nextSibling)
		}
		else {
			vnode.dom = old.dom
			vnode.domSize = old.domSize
			vnode.instance = old.instance
		}
	}
	function updateFragment(parent, old, vnode, hooks, nextSibling, ns) {
		updateNodes(parent, old.children, vnode.children, hooks, nextSibling, ns)
		var domSize = 0, children = vnode.children
		vnode.dom = null
		if (children != null) {
			for (var i = 0; i < children.length; i++) {
				var child = children[i]
				if (child != null && child.dom != null) {
					if (vnode.dom == null) vnode.dom = child.dom
					domSize += child.domSize || 1
				}
			}
			if (domSize !== 1) vnode.domSize = domSize
		}
	}
	function updateElement(old, vnode, hooks, ns) {
		var element = vnode.dom = old.dom
		ns = getNameSpace(vnode) || ns

		if (vnode.tag === "textarea") {
			if (vnode.attrs == null) vnode.attrs = {}
			if (vnode.text != null) {
				vnode.attrs.value = vnode.text //FIXME handle multiple children
				vnode.text = undefined
			}
		}
		updateAttrs(vnode, old.attrs, vnode.attrs, ns)
		if (!maybeSetContentEditable(vnode)) {
			if (old.text != null && vnode.text != null && vnode.text !== "") {
				if (old.text.toString() !== vnode.text.toString()) old.dom.firstChild.nodeValue = vnode.text
			}
			else {
				if (old.text != null) old.children = [Vnode("#", undefined, undefined, old.text, undefined, old.dom.firstChild)]
				if (vnode.text != null) vnode.children = [Vnode("#", undefined, undefined, vnode.text, undefined, undefined)]
				updateNodes(element, old.children, vnode.children, hooks, null, ns)
			}
		}
	}
	function updateComponent(parent, old, vnode, hooks, nextSibling, ns) {
		vnode.instance = Vnode.normalize(callHook.call(vnode.state.view, vnode))
		if (vnode.instance === vnode) throw Error("A view cannot return the vnode it received as argument")
		updateLifecycle(vnode.state, vnode, hooks)
		if (vnode.attrs != null) updateLifecycle(vnode.attrs, vnode, hooks)
		if (vnode.instance != null) {
			if (old.instance == null) createNode(parent, vnode.instance, hooks, ns, nextSibling)
			else updateNode(parent, old.instance, vnode.instance, hooks, nextSibling, ns)
			vnode.dom = vnode.instance.dom
			vnode.domSize = vnode.instance.domSize
		}
		else if (old.instance != null) {
			removeNode(parent, old.instance)
			vnode.dom = undefined
			vnode.domSize = 0
		}
		else {
			vnode.dom = old.dom
			vnode.domSize = old.domSize
		}
	}
	function getKeyMap(vnodes, start, end) {
		var map = Object.create(null)
		for (; start < end; start++) {
			var vnode = vnodes[start]
			if (vnode != null) {
				var key = vnode.key
				if (key != null) map[key] = start
			}
		}
		return map
	}
	// Lifted from ivi https://github.com/ivijs/ivi/
	// takes a list of unique numbers (-1 is special and can
	// occur multiple times) and returns an array with the indices
	// of the items that are part of the longest increasing
	// subsequece
	var lisTemp = []
	function makeLisIndices(a) {
		var result = [0]
		var u = 0, v = 0, i = 0
		var il = lisTemp.length = a.length
		for (var i = 0; i < il; i++) lisTemp[i] = a[i]
		for (var i = 0; i < il; ++i) {
			if (a[i] === -1) continue
			var j = result[result.length - 1]
			if (a[j] < a[i]) {
				lisTemp[i] = j
				result.push(i)
				continue
			}
			u = 0
			v = result.length - 1
			while (u < v) {
				// Fast integer average without overflow.
				// eslint-disable-next-line no-bitwise
				var c = (u >>> 1) + (v >>> 1) + (u & v & 1)
				if (a[result[c]] < a[i]) {
					u = c + 1
				}
				else {
					v = c
				}
			}
			if (a[i] < a[result[u]]) {
				if (u > 0) lisTemp[i] = result[u - 1]
				result[u] = i
			}
		}
		u = result.length
		v = result[u - 1]
		while (u-- > 0) {
			result[u] = v
			v = lisTemp[v]
		}
		lisTemp.length = 0
		return result
	}

	function getNextSibling(vnodes, i, nextSibling) {
		for (; i < vnodes.length; i++) {
			if (vnodes[i] != null && vnodes[i].dom != null) return vnodes[i].dom
		}
		return nextSibling
	}

	// This covers a really specific edge case:
	// - Parent node is keyed and contains child
	// - Child is removed, returns unresolved promise in `onbeforeremove`
	// - Parent node is moved in keyed diff
	// - Remaining children still need moved appropriately
	//
	// Ideally, I'd track removed nodes as well, but that introduces a lot more
	// complexity and I'm not exactly interested in doing that.
	function moveNodes(parent, vnode, nextSibling) {
		var frag = $doc.createDocumentFragment()
		moveChildToFrag(parent, frag, vnode)
		insertNode(parent, frag, nextSibling)
	}
	function moveChildToFrag(parent, frag, vnode) {
		// Dodge the recursion overhead in a few of the most common cases.
		while (vnode.dom != null && vnode.dom.parentNode === parent) {
			if (typeof vnode.tag !== "string") {
				vnode = vnode.instance
				if (vnode != null) continue
			} else if (vnode.tag === "<") {
				for (var i = 0; i < vnode.instance.length; i++) {
					frag.appendChild(vnode.instance[i])
				}
			} else if (vnode.tag !== "[") {
				// Don't recurse for text nodes *or* elements, just fragments
				frag.appendChild(vnode.dom)
			} else if (vnode.children.length === 1) {
				vnode = vnode.children[0]
				if (vnode != null) continue
			} else {
				for (var i = 0; i < vnode.children.length; i++) {
					var child = vnode.children[i]
					if (child != null) moveChildToFrag(parent, frag, child)
				}
			}
			break
		}
	}

	function insertNode(parent, dom, nextSibling) {
		if (nextSibling != null) parent.insertBefore(dom, nextSibling)
		else parent.appendChild(dom)
	}

	function maybeSetContentEditable(vnode) {
		if (vnode.attrs == null || (
			vnode.attrs.contenteditable == null && // attribute
			vnode.attrs.contentEditable == null // property
		)) return false
		var children = vnode.children
		if (children != null && children.length === 1 && children[0].tag === "<") {
			var content = children[0].children
			if (vnode.dom.innerHTML !== content) vnode.dom.innerHTML = content
		}
		else if (vnode.text != null || children != null && children.length !== 0) throw new Error("Child node of a contenteditable must be trusted")
		return true
	}

	//remove
	function removeNodes(parent, vnodes, start, end) {
		for (var i = start; i < end; i++) {
			var vnode = vnodes[i]
			if (vnode != null) removeNode(parent, vnode)
		}
	}
	function removeNode(parent, vnode) {
		var mask = 0
		var original = vnode.state
		var stateResult, attrsResult
		if (typeof vnode.tag !== "string" && typeof vnode.state.onbeforeremove === "function") {
			var result = callHook.call(vnode.state.onbeforeremove, vnode)
			if (result != null && typeof result.then === "function") {
				mask = 1
				stateResult = result
			}
		}
		if (vnode.attrs && typeof vnode.attrs.onbeforeremove === "function") {
			var result = callHook.call(vnode.attrs.onbeforeremove, vnode)
			if (result != null && typeof result.then === "function") {
				// eslint-disable-next-line no-bitwise
				mask |= 2
				attrsResult = result
			}
		}
		checkState(vnode, original)

		// If we can, try to fast-path it and avoid all the overhead of awaiting
		if (!mask) {
			onremove(vnode)
			removeChild(parent, vnode)
		} else {
			if (stateResult != null) {
				var next = function () {
					// eslint-disable-next-line no-bitwise
					if (mask & 1) { mask &= 2; if (!mask) reallyRemove() }
				}
				stateResult.then(next, next)
			}
			if (attrsResult != null) {
				var next = function () {
					// eslint-disable-next-line no-bitwise
					if (mask & 2) { mask &= 1; if (!mask) reallyRemove() }
				}
				attrsResult.then(next, next)
			}
		}

		function reallyRemove() {
			checkState(vnode, original)
			onremove(vnode)
			removeChild(parent, vnode)
		}
	}
	function removeHTML(parent, vnode) {
		for (var i = 0; i < vnode.instance.length; i++) {
			parent.removeChild(vnode.instance[i])
		}
	}
	function removeChild(parent, vnode) {
		// Dodge the recursion overhead in a few of the most common cases.
		while (vnode.dom != null && vnode.dom.parentNode === parent) {
			if (typeof vnode.tag !== "string") {
				vnode = vnode.instance
				if (vnode != null) continue
			} else if (vnode.tag === "<") {
				removeHTML(parent, vnode)
			} else {
				if (vnode.tag !== "[") {
					parent.removeChild(vnode.dom)
					if (!Array.isArray(vnode.children)) break
				}
				if (vnode.children.length === 1) {
					vnode = vnode.children[0]
					if (vnode != null) continue
				} else {
					for (var i = 0; i < vnode.children.length; i++) {
						var child = vnode.children[i]
						if (child != null) removeChild(parent, child)
					}
				}
			}
			break
		}
	}
	function onremove(vnode) {
		if (typeof vnode.tag !== "string" && typeof vnode.state.onremove === "function") callHook.call(vnode.state.onremove, vnode)
		if (vnode.attrs && typeof vnode.attrs.onremove === "function") callHook.call(vnode.attrs.onremove, vnode)
		if (typeof vnode.tag !== "string") {
			if (vnode.instance != null) onremove(vnode.instance)
		} else {
			var children = vnode.children
			if (Array.isArray(children)) {
				for (var i = 0; i < children.length; i++) {
					var child = children[i]
					if (child != null) onremove(child)
				}
			}
		}
	}

	//attrs
	function setAttrs(vnode, attrs, ns) {
		for (var key in attrs) {
			setAttr(vnode, key, null, attrs[key], ns)
		}
	}
	function setAttr(vnode, key, old, value, ns) {
		if (key === "key" || key === "is" || value == null || isLifecycleMethod(key) || (old === value && !isFormAttribute(vnode, key)) && typeof value !== "object") return
		if (key[0] === "o" && key[1] === "n") return updateEvent(vnode, key, value)
		if (key.slice(0, 6) === "xlink:") vnode.dom.setAttributeNS("http://www.w3.org/1999/xlink", key.slice(6), value)
		else if (key === "style") updateStyle(vnode.dom, old, value)
		else if (hasPropertyKey(vnode, key, ns)) {
			if (key === "value") {
				// Only do the coercion if we're actually going to check the value.
				/* eslint-disable no-implicit-coercion */
				//setting input[value] to same value by typing on focused element moves cursor to end in Chrome
				if ((vnode.tag === "input" || vnode.tag === "textarea") && vnode.dom.value === "" + value && vnode.dom === activeElement()) return
				//setting select[value] to same value while having select open blinks select dropdown in Chrome
				if (vnode.tag === "select" && old !== null && vnode.dom.value === "" + value) return
				//setting option[value] to same value while having select open blinks select dropdown in Chrome
				if (vnode.tag === "option" && old !== null && vnode.dom.value === "" + value) return
				/* eslint-enable no-implicit-coercion */
			}
			// If you assign an input type that is not supported by IE 11 with an assignment expression, an error will occur.
			if (vnode.tag === "input" && key === "type") vnode.dom.setAttribute(key, value)
			else vnode.dom[key] = value
		} else {
			if (typeof value === "boolean") {
				if (value) vnode.dom.setAttribute(key, "")
				else vnode.dom.removeAttribute(key)
			}
			else vnode.dom.setAttribute(key === "className" ? "class" : key, value)
		}
	}
	function removeAttr(vnode, key, old, ns) {
		if (key === "key" || key === "is" || old == null || isLifecycleMethod(key)) return
		if (key[0] === "o" && key[1] === "n" && !isLifecycleMethod(key)) updateEvent(vnode, key, undefined)
		else if (key === "style") updateStyle(vnode.dom, old, null)
		else if (
			hasPropertyKey(vnode, key, ns)
			&& key !== "className"
			&& !(key === "value" && (
				vnode.tag === "option"
				|| vnode.tag === "select" && vnode.dom.selectedIndex === -1 && vnode.dom === activeElement()
			))
			&& !(vnode.tag === "input" && key === "type")
		) {
			vnode.dom[key] = null
		} else {
			var nsLastIndex = key.indexOf(":")
			if (nsLastIndex !== -1) key = key.slice(nsLastIndex + 1)
			if (old !== false) vnode.dom.removeAttribute(key === "className" ? "class" : key)
		}
	}
	function setLateSelectAttrs(vnode, attrs) {
		if ("value" in attrs) {
			if(attrs.value === null) {
				if (vnode.dom.selectedIndex !== -1) vnode.dom.value = null
			} else {
				var normalized = "" + attrs.value // eslint-disable-line no-implicit-coercion
				if (vnode.dom.value !== normalized || vnode.dom.selectedIndex === -1) {
					vnode.dom.value = normalized
				}
			}
		}
		if ("selectedIndex" in attrs) setAttr(vnode, "selectedIndex", null, attrs.selectedIndex, undefined)
	}
	function updateAttrs(vnode, old, attrs, ns) {
		if (attrs != null) {
			for (var key in attrs) {
				setAttr(vnode, key, old && old[key], attrs[key], ns)
			}
		}
		var val
		if (old != null) {
			for (var key in old) {
				if (((val = old[key]) != null) && (attrs == null || attrs[key] == null)) {
					removeAttr(vnode, key, val, ns)
				}
			}
		}
	}
	function isFormAttribute(vnode, attr) {
		return attr === "value" || attr === "checked" || attr === "selectedIndex" || attr === "selected" && vnode.dom === activeElement() || vnode.tag === "option" && vnode.dom.parentNode === $doc.activeElement
	}
	function isLifecycleMethod(attr) {
		return attr === "oninit" || attr === "oncreate" || attr === "onupdate" || attr === "onremove" || attr === "onbeforeremove" || attr === "onbeforeupdate"
	}
	function hasPropertyKey(vnode, key, ns) {
		// Filter out namespaced keys
		return ns === undefined && (
			// If it's a custom element, just keep it.
			vnode.tag.indexOf("-") > -1 || vnode.attrs != null && vnode.attrs.is ||
			// If it's a normal element, let's try to avoid a few browser bugs.
			key !== "href" && key !== "list" && key !== "form" && key !== "width" && key !== "height"// && key !== "type"
			// Defer the property check until *after* we check everything.
		) && key in vnode.dom
	}

	//style
	var uppercaseRegex = /[A-Z]/g
	function toLowerCase(capital) { return "-" + capital.toLowerCase() }
	function normalizeKey(key) {
		return key[0] === "-" && key[1] === "-" ? key :
			key === "cssFloat" ? "float" :
				key.replace(uppercaseRegex, toLowerCase)
	}
	function updateStyle(element, old, style) {
		if (old === style) {
			// Styles are equivalent, do nothing.
		} else if (style == null) {
			// New style is missing, just clear it.
			element.style.cssText = ""
		} else if (typeof style !== "object") {
			// New style is a string, let engine deal with patching.
			element.style.cssText = style
		} else if (old == null || typeof old !== "object") {
			// `old` is missing or a string, `style` is an object.
			element.style.cssText = ""
			// Add new style properties
			for (var key in style) {
				var value = style[key]
				if (value != null) element.style.setProperty(normalizeKey(key), String(value))
			}
		} else {
			// Both old & new are (different) objects.
			// Update style properties that have changed
			for (var key in style) {
				var value = style[key]
				if (value != null && (value = String(value)) !== String(old[key])) {
					element.style.setProperty(normalizeKey(key), value)
				}
			}
			// Remove style properties that no longer exist
			for (var key in old) {
				if (old[key] != null && style[key] == null) {
					element.style.removeProperty(normalizeKey(key))
				}
			}
		}
	}

	// Here's an explanation of how this works:
	// 1. The event names are always (by design) prefixed by `on`.
	// 2. The EventListener interface accepts either a function or an object
	//    with a `handleEvent` method.
	// 3. The object does not inherit from `Object.prototype`, to avoid
	//    any potential interference with that (e.g. setters).
	// 4. The event name is remapped to the handler before calling it.
	// 5. In function-based event handlers, `ev.target === this`. We replicate
	//    that below.
	// 6. In function-based event handlers, `return false` prevents the default
	//    action and stops event propagation. We replicate that below.
	function EventDict() {
		// Save this, so the current redraw is correctly tracked.
		this._ = currentRedraw
	}
	EventDict.prototype = Object.create(null)
	EventDict.prototype.handleEvent = function (ev) {
		var handler = this["on" + ev.type]
		var result
		if (typeof handler === "function") result = handler.call(ev.currentTarget, ev)
		else if (typeof handler.handleEvent === "function") handler.handleEvent(ev)
		if (this._ && ev.redraw !== false) (0, this._)()
		if (result === false) {
			ev.preventDefault()
			ev.stopPropagation()
		}
	}

	//event
	function updateEvent(vnode, key, value) {
		if (vnode.events != null) {
			if (vnode.events[key] === value) return
			if (value != null && (typeof value === "function" || typeof value === "object")) {
				if (vnode.events[key] == null) vnode.dom.addEventListener(key.slice(2), vnode.events, false)
				vnode.events[key] = value
			} else {
				if (vnode.events[key] != null) vnode.dom.removeEventListener(key.slice(2), vnode.events, false)
				vnode.events[key] = undefined
			}
		} else if (value != null && (typeof value === "function" || typeof value === "object")) {
			vnode.events = new EventDict()
			vnode.dom.addEventListener(key.slice(2), vnode.events, false)
			vnode.events[key] = value
		}
	}

	//lifecycle
	function initLifecycle(source, vnode, hooks) {
		if (typeof source.oninit === "function") callHook.call(source.oninit, vnode)
		if (typeof source.oncreate === "function") hooks.push(callHook.bind(source.oncreate, vnode))
	}
	function updateLifecycle(source, vnode, hooks) {
		if (typeof source.onupdate === "function") hooks.push(callHook.bind(source.onupdate, vnode))
	}
	function shouldNotUpdate(vnode, old) {
		do {
			if (vnode.attrs != null && typeof vnode.attrs.onbeforeupdate === "function") {
				var force = callHook.call(vnode.attrs.onbeforeupdate, vnode, old)
				if (force !== undefined && !force) break
			}
			if (typeof vnode.tag !== "string" && typeof vnode.state.onbeforeupdate === "function") {
				var force = callHook.call(vnode.state.onbeforeupdate, vnode, old)
				if (force !== undefined && !force) break
			}
			return false
		} while (false); // eslint-disable-line no-constant-condition
		vnode.dom = old.dom
		vnode.domSize = old.domSize
		vnode.instance = old.instance
		// One would think having the actual latest attributes would be ideal,
		// but it doesn't let us properly diff based on our current internal
		// representation. We have to save not only the old DOM info, but also
		// the attributes used to create it, as we diff *that*, not against the
		// DOM directly (with a few exceptions in `setAttr`). And, of course, we
		// need to save the children and text as they are conceptually not
		// unlike special "attributes" internally.
		vnode.attrs = old.attrs
		vnode.children = old.children
		vnode.text = old.text
		return true
	}

	return function(dom, vnodes, redraw) {
		if (!dom) throw new TypeError("Ensure the DOM element being passed to m.route/m.mount/m.render is not undefined.")
		var hooks = []
		var active = activeElement()
		var namespace = dom.namespaceURI

		// First time rendering into a node clears it out
		if (dom.vnodes == null) dom.textContent = ""

		vnodes = Vnode.normalizeChildren(Array.isArray(vnodes) ? vnodes : [vnodes])
		var prevRedraw = currentRedraw
		try {
			currentRedraw = typeof redraw === "function" ? redraw : undefined
			updateNodes(dom, dom.vnodes, vnodes, hooks, null, namespace === "http://www.w3.org/1999/xhtml" ? undefined : namespace)
		} finally {
			currentRedraw = prevRedraw
		}
		dom.vnodes = vnodes
		// `document.activeElement` can return null: https://html.spec.whatwg.org/multipage/interaction.html#dom-document-activeelement
		if (active != null && activeElement() !== active && typeof active.focus === "function") active.focus()
		for (var i = 0; i < hooks.length; i++) hooks[i]()
	}
}


/***/ }),

/***/ "./node_modules/mithril/render/trust.js":
/*!**********************************************!*\
  !*** ./node_modules/mithril/render/trust.js ***!
  \**********************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var Vnode = __webpack_require__(/*! ../render/vnode */ "./node_modules/mithril/render/vnode.js")

module.exports = function(html) {
	if (html == null) html = ""
	return Vnode("<", undefined, undefined, html, undefined, undefined)
}


/***/ }),

/***/ "./node_modules/mithril/render/vnode.js":
/*!**********************************************!*\
  !*** ./node_modules/mithril/render/vnode.js ***!
  \**********************************************/
/***/ ((module) => {



function Vnode(tag, key, attrs, children, text, dom) {
	return {tag: tag, key: key, attrs: attrs, children: children, text: text, dom: dom, domSize: undefined, state: undefined, events: undefined, instance: undefined}
}
Vnode.normalize = function(node) {
	if (Array.isArray(node)) return Vnode("[", undefined, undefined, Vnode.normalizeChildren(node), undefined, undefined)
	if (node == null || typeof node === "boolean") return null
	if (typeof node === "object") return node
	return Vnode("#", undefined, undefined, String(node), undefined, undefined)
}
Vnode.normalizeChildren = function(input) {
	var children = []
	if (input.length) {
		var isKeyed = input[0] != null && input[0].key != null
		// Note: this is a *very* perf-sensitive check.
		// Fun fact: merging the loop like this is somehow faster than splitting
		// it, noticeably so.
		for (var i = 1; i < input.length; i++) {
			if ((input[i] != null && input[i].key != null) !== isKeyed) {
				throw new TypeError("Vnodes must either always have keys or never have keys!")
			}
		}
		for (var i = 0; i < input.length; i++) {
			children[i] = Vnode.normalize(input[i])
		}
	}
	return children
}

module.exports = Vnode


/***/ }),

/***/ "./node_modules/mithril/request.js":
/*!*****************************************!*\
  !*** ./node_modules/mithril/request.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var PromisePolyfill = __webpack_require__(/*! ./promise/promise */ "./node_modules/mithril/promise/promise.js")
var mountRedraw = __webpack_require__(/*! ./mount-redraw */ "./node_modules/mithril/mount-redraw.js")

module.exports = __webpack_require__(/*! ./request/request */ "./node_modules/mithril/request/request.js")(window, PromisePolyfill, mountRedraw.redraw)


/***/ }),

/***/ "./node_modules/mithril/request/request.js":
/*!*************************************************!*\
  !*** ./node_modules/mithril/request/request.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var buildPathname = __webpack_require__(/*! ../pathname/build */ "./node_modules/mithril/pathname/build.js")

module.exports = function($window, Promise, oncompletion) {
	var callbackCount = 0

	function PromiseProxy(executor) {
		return new Promise(executor)
	}

	// In case the global Promise is some userland library's where they rely on
	// `foo instanceof this.constructor`, `this.constructor.resolve(value)`, or
	// similar. Let's *not* break them.
	PromiseProxy.prototype = Promise.prototype
	PromiseProxy.__proto__ = Promise // eslint-disable-line no-proto

	function makeRequest(factory) {
		return function(url, args) {
			if (typeof url !== "string") { args = url; url = url.url }
			else if (args == null) args = {}
			var promise = new Promise(function(resolve, reject) {
				factory(buildPathname(url, args.params), args, function (data) {
					if (typeof args.type === "function") {
						if (Array.isArray(data)) {
							for (var i = 0; i < data.length; i++) {
								data[i] = new args.type(data[i])
							}
						}
						else data = new args.type(data)
					}
					resolve(data)
				}, reject)
			})
			if (args.background === true) return promise
			var count = 0
			function complete() {
				if (--count === 0 && typeof oncompletion === "function") oncompletion()
			}

			return wrap(promise)

			function wrap(promise) {
				var then = promise.then
				// Set the constructor, so engines know to not await or resolve
				// this as a native promise. At the time of writing, this is
				// only necessary for V8, but their behavior is the correct
				// behavior per spec. See this spec issue for more details:
				// https://github.com/tc39/ecma262/issues/1577. Also, see the
				// corresponding comment in `request/tests/test-request.js` for
				// a bit more background on the issue at hand.
				promise.constructor = PromiseProxy
				promise.then = function() {
					count++
					var next = then.apply(promise, arguments)
					next.then(complete, function(e) {
						complete()
						if (count === 0) throw e
					})
					return wrap(next)
				}
				return promise
			}
		}
	}

	function hasHeader(args, name) {
		for (var key in args.headers) {
			if ({}.hasOwnProperty.call(args.headers, key) && name.test(key)) return true
		}
		return false
	}

	return {
		request: makeRequest(function(url, args, resolve, reject) {
			var method = args.method != null ? args.method.toUpperCase() : "GET"
			var body = args.body
			var assumeJSON = (args.serialize == null || args.serialize === JSON.serialize) && !(body instanceof $window.FormData)
			var responseType = args.responseType || (typeof args.extract === "function" ? "" : "json")

			var xhr = new $window.XMLHttpRequest(), aborted = false
			var original = xhr, replacedAbort
			var abort = xhr.abort

			xhr.abort = function() {
				aborted = true
				abort.call(this)
			}

			xhr.open(method, url, args.async !== false, typeof args.user === "string" ? args.user : undefined, typeof args.password === "string" ? args.password : undefined)

			if (assumeJSON && body != null && !hasHeader(args, /^content-type$/i)) {
				xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8")
			}
			if (typeof args.deserialize !== "function" && !hasHeader(args, /^accept$/i)) {
				xhr.setRequestHeader("Accept", "application/json, text/*")
			}
			if (args.withCredentials) xhr.withCredentials = args.withCredentials
			if (args.timeout) xhr.timeout = args.timeout
			xhr.responseType = responseType

			for (var key in args.headers) {
				if ({}.hasOwnProperty.call(args.headers, key)) {
					xhr.setRequestHeader(key, args.headers[key])
				}
			}

			xhr.onreadystatechange = function(ev) {
				// Don't throw errors on xhr.abort().
				if (aborted) return

				if (ev.target.readyState === 4) {
					try {
						var success = (ev.target.status >= 200 && ev.target.status < 300) || ev.target.status === 304 || (/^file:\/\//i).test(url)
						// When the response type isn't "" or "text",
						// `xhr.responseText` is the wrong thing to use.
						// Browsers do the right thing and throw here, and we
						// should honor that and do the right thing by
						// preferring `xhr.response` where possible/practical.
						var response = ev.target.response, message

						if (responseType === "json") {
							// For IE and Edge, which don't implement
							// `responseType: "json"`.
							if (!ev.target.responseType && typeof args.extract !== "function") response = JSON.parse(ev.target.responseText)
						} else if (!responseType || responseType === "text") {
							// Only use this default if it's text. If a parsed
							// document is needed on old IE and friends (all
							// unsupported), the user should use a custom
							// `config` instead. They're already using this at
							// their own risk.
							if (response == null) response = ev.target.responseText
						}

						if (typeof args.extract === "function") {
							response = args.extract(ev.target, args)
							success = true
						} else if (typeof args.deserialize === "function") {
							response = args.deserialize(response)
						}
						if (success) resolve(response)
						else {
							try { message = ev.target.responseText }
							catch (e) { message = response }
							var error = new Error(message)
							error.code = ev.target.status
							error.response = response
							reject(error)
						}
					}
					catch (e) {
						reject(e)
					}
				}
			}

			if (typeof args.config === "function") {
				xhr = args.config(xhr, args, url) || xhr

				// Propagate the `abort` to any replacement XHR as well.
				if (xhr !== original) {
					replacedAbort = xhr.abort
					xhr.abort = function() {
						aborted = true
						replacedAbort.call(this)
					}
				}
			}

			if (body == null) xhr.send()
			else if (typeof args.serialize === "function") xhr.send(args.serialize(body))
			else if (body instanceof $window.FormData) xhr.send(body)
			else xhr.send(JSON.stringify(body))
		}),
		jsonp: makeRequest(function(url, args, resolve, reject) {
			var callbackName = args.callbackName || "_mithril_" + Math.round(Math.random() * 1e16) + "_" + callbackCount++
			var script = $window.document.createElement("script")
			$window[callbackName] = function(data) {
				delete $window[callbackName]
				script.parentNode.removeChild(script)
				resolve(data)
			}
			script.onerror = function() {
				delete $window[callbackName]
				script.parentNode.removeChild(script)
				reject(new Error("JSONP request failed"))
			}
			script.src = url + (url.indexOf("?") < 0 ? "?" : "&") +
				encodeURIComponent(args.callbackKey || "callback") + "=" +
				encodeURIComponent(callbackName)
			$window.document.documentElement.appendChild(script)
		}),
	}
}


/***/ }),

/***/ "./node_modules/mithril/route.js":
/*!***************************************!*\
  !*** ./node_modules/mithril/route.js ***!
  \***************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



var mountRedraw = __webpack_require__(/*! ./mount-redraw */ "./node_modules/mithril/mount-redraw.js")

module.exports = __webpack_require__(/*! ./api/router */ "./node_modules/mithril/api/router.js")(window, mountRedraw)


/***/ }),

/***/ "./www/js/models/auth.js":
/*!*******************************!*\
  !*** ./www/js/models/auth.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);



let auth = {
    url: "https://lager.emilfolino.se/v2/auth/login",
    email: "",
    password: "",
    token: "",

    login: function() {
        mithril__WEBPACK_IMPORTED_MODULE_0___default().request({
            url: auth.url,
            method: "POST",
            body: {
                email: auth.email,
                password: auth.password,
                api_key: "785a264c48edd237e29d1ae95bf39859"
            }
        }).then(function(result) {
            auth.email = "";
            auth.password = "";
            console.log(result.data.token);

            auth.token = result.data.token;
            return mithril__WEBPACK_IMPORTED_MODULE_0___default().route.set("/");
        });
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (auth);


/***/ }),

/***/ "./www/js/models/cocktails.js":
/*!************************************!*\
  !*** ./www/js/models/cocktails.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);



let cocktailsModel = {
    current: {},
    getCocktail: function() {
        mithril__WEBPACK_IMPORTED_MODULE_0___default().request({
            url: `https://www.thecocktaildb.com/api/json/v1/1/random.php`,
            method: "GET",
        }).then(function(result) {
            // console.log(result.drinks[0]);
            cocktailsModel.current = result.drinks[0];
            console.log(cocktailsModel.current);
        });
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (cocktailsModel);


/***/ }),

/***/ "./www/js/models/food.js":
/*!*******************************!*\
  !*** ./www/js/models/food.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);



let foodModel = {
    current: {},
    getFood: function() {
        mithril__WEBPACK_IMPORTED_MODULE_0___default().request({
            url: `https://www.themealdb.com/api/json/v1/1/random.php`,
            method: "GET",
        }).then(function(result) {
            // console.log(result.drinks[0]);
            foodModel.current = result.meals[0];
            console.log(foodModel.current);
        });
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (foodModel);


/***/ }),

/***/ "./www/js/models/links/links.json":
/*!****************************************!*\
  !*** ./www/js/models/links/links.json ***!
  \****************************************/
/***/ ((module) => {

module.exports = JSON.parse('{"Movies":["0114709","0113497","0113228","0114885","0113041","0113277","0114319","0112302","0114576","0113189","0112346","0112896","0112453","0113987","0112760","0112641","0114388","0113101","0112281","0113845","0113161","0112722","0112401","0114168","0113627","0114057","0114011","0114117","0112682","0115012","0112792","0114746","0112431","0112818","0113442","0112697","0112749","0114279","0112819","0114272","0113855","0114681","0113347","0114369","0114148","0114916","0114814","0113819","0110299","0112499","0113158","0113321","0110877","0113419","0116260","0113862","0116126","0118002","0115683","0116839","0113149","0113118","0116367","0113010","0113537","0113828","0115644","0115676","0114367","0113973","0112744","0116731","0112445","0114660","0112379","0114039","0112365","0118158","0116151","0115697","0113972","0117002","0114825","0115639","0115759","0113403","0113247","0113283","0115907","0115734","0117102","0118040","0116483","0112579","0110251","0117110","0112646","0112573","0075314","0113326","0115645","0112373","0115033","0116606","0114536","0106473","0103859","0109424","0116324","0110647","0110217","0114131","0113451","0116130","0113756","0118055","0115685","0112585","0112442","0112342","0112461","0112427","0109093","0112384","0114287","0112288","0112462","0061395","0112495","0112541","0109370","0112642","0112688","0112715","0112740","0109508","0112851","0112857","0112864","0112887","0113071","0113114","0113243","0113464","0113481","0113492","0113500","0113540","0113677","0113690","0107447","0113729","0113749","0113820","0110604","0110620","0113957","0113986","0114095","0114194","0114241","0114323","0114345","0114436","0114478","0114496","0114508","0114558","0058450","0114663","0114702","0114682","0114781","0114798","0114805","0114887","0114898","0114928","0114938","0109340","0112602","0111579","0110882","0112471","0112508","0112438","0112571","0112757","0112643","0112679","0109445","0112883","0109635","0109676","0112854","0109579","0109642","0109686","0111797","0109759","0109758","0109707","0113117","0113097","0113028","0113198","0113303","0113089","0109771","0113199","0110057","0110005","0110066","0110116","0110006","0113360","0110099","0110148","0113463","0110189","0110216","0113501","0113538","0113552","0076759","0110367","0113670","0110296","0103994","0110322","0110443","0107566","0110391","0113691","0110428","0109836","0113755","0110538","0110516","0110527","0113808","0113896","0113870","0110684","0110638","0113967","0117169","0106402","0110671","0110632","0110737","0110729","0114151","0114069","0110413","0114113","0114210","0110912","0105652","0110889","0110932","0114129","0110963","0114214","0114296","0110907","0111495","0108394","0111507","0114268","0110965","0114571","0111333","0111112","0111255","0111282","0111070","0111161","0111149","0108260","0106966","0114594","0111309","0113936","0110081","0114614","0114608","0111280","0114609","0111454","0114852","0114694","0111590","0114788","0114888","0108550","0114857","0114924","0111667","0109655","0110598","0112435","0109040","0109045","0106339","0104779","0109348","0109444","0109446","0109484","0109504","0109506","0109450","0109813","0109830","0109831","0113305","0110091","0110093","0110167","0110213","0107472","0110357","0107426","0111686","0110475","0110478","0110588","0110622","0110771","0110950","0105226","0110989","0110997","0111257","0111256","0111438","0111503","0111693","0111742","0111756","0112443","0110455","0111048","0110399","0112570","0109454","0059170","0110186","0111301","0110027","0109785","0113409","0109021","0109035","0106220","0106226","0109068","0109067","0106292","0109198","0109219","0106379","0106400","0109254","0109279","0109297","0109303","0109305","0109306","0106452","0106471","0106489","0109361","0106505","0106519","0109439","0109443","0106582","0106598","0109456","0109480","0109493","0106673","0106677","0106697","0106834","0106873","0106332","0106881","0106880","0111732","0106926","0111712","0106941","0106918","0106965","0109842","0106977","0107004","0109890","0109891","0109913","0107076","0107144","0113674","0112966","0107151","0110064","0110074","0110097","0110123","0107206","0107207","0110137","0108551","0110197","0107286","0107290","0107302","0110265","0110305","0107362","0107413","0110353","0107468","0107478","0107497","0107501","0107507","0107554","0116253","0074102","0111689","0107616","0107613","0107614","0107653","0110657","0110678","0110687","0107756","0107808","0107818","0107822","0107840","0107889","0111003","0110939","0110955","0107943","0110971","0107969","0111001","0107978","0107977","0107983","0105275","0108000","0108002","0105032","0108052","0111094","0108065","0108071","0111127","0111143","0108101","0108122","0111194","0111201","0108149","0108160","0108162","0083658","0108186","0108174","0108238","0108255","0111323","0111400","0108328","0111418","0107688","0108333","0108358","0108399","0108515","0110763","0114906","0107002","0109403","0107315","0106408","0110363","0107225","0111252","0110366","0109120","0108059","0110892","0112651","0109382","0112572","0099785","0099653","0103639","0103064","0099348","0096895","0102926","0029583","0101414","0032910","0100405","0065214","0110395","0109934","0117247","0112625","0116282","0116552","0082509","0116514","0117283","0116684","0070506","0065421","0113083","0118001","0116165","0117891","0113613","0117381","0115509","0114671","0112844","0114658","0116275","0113122","0117608","0113448","0116414","0116095","0113947","0115956","0117060","0109028","0117071","0116136","0116168","0116683","0116287","0116768","0114787","0112536","0048473","0052572","0117128","0117705","0062711","0108181","0114307","0058898","0113443","0114048","0117104","0117688","0117774","0114736","0116289","0109593","0112368","0115742","0117420","0117784","0117107","0117979","0095776","0115851","0116322","0112817","0113362","0108500","0117108","0118114","0113270","0115963","0116448","0116827","0112701","0116508","0117500","0109592","0117998","0115624","0113568","0117894","0117723","0112691","0117768","0115571","0057012","0109688","0110480","0108211","0117331","0117765","0113280","0116669","0116594","0070820","0063715","0117951","0118523","0116629","0117737","0116277","0116583","0115798","0116778","0116213","0117218","0111546","0111237","0116040","0116365","0116905","0116493","0117333","0118113","0117628","0117913","0115530","0115493","0116320","0116756","0116823","0118073","0061495","0110246","0115472","0116707","0116313","0117438","0116531","0116353","0115857","0117008","0116191","0115986","0116571","0053459","0117826","0117718","0116225","0115632","0117918","0068646","0104558","0115736","0115836","0116745","0119214","0110693","0106544","0120004","0116654","0116311","0117965","0115725","0115783","0113596","0109001","0113253","0117991","0117093","0111019","0035896","0032904","0045152","0043278","0050419","0054698","0052357","0047396","0025316","0036855","0025164","0053125","0053604","0053291","0056923","0034583","0033870","0058385","0047437","0046250","0031580","0037059","0032138","0031381","0084370","0043014","0033467","0062622","0042192","0032143","0032976","0032484","0038787","0038109","0050105","0048728","0042451","0045537","0031725","0050658","0051658","0029843","0032762","0037008","0039420","0029162","0027125","0035446","0028010","0049261","0048028","0025878","0032599","0048960","0038650","0031679","0029947","0034012","0025586","0027893","0041509","0026029","0063350","0043265","0046414","0051459","0033891","0022879","0114007","0118927","0048491","0117357","0116329","0118742","0116442","0117011","0117039","0116635","0115678","0116830","0117603","0115438","0116259","0116421","0116000","0115862","0072653","0047977","0072951","0064603","0071607","0050798","0055277","0054195","0107131","0053271","0054357","0059793","0046672","0106611","0109127","0042332","0063819","0038166","0057546","0102798","0058331","0033563","0076538","0066817","0043274","0082406","0116361","0059742","0095016","0104692","0117582","0117589","0117887","0117924","0115640","0116908","0116409","0116913","0117958","0117202","0116404","0120107","0116722","0116242","0117509","0117802","0117665","0115491","0029546","0039286","0067992","0055018","0070707","0066808","0095159","0079470","0084865","0068334","0059243","0061418","0052027","0046912","0092890","0105236","0091763","0098627","0103772","0101761","0104036","0104348","0084707","0083866","0029992","0099371","0092099","0048545","0044081","0115885","0117040","0117284","0116378","0113057","0116581","0112907","0117318","0116422","0117320","0082846","0072081","0101775","0096754","0080749","0082340","0082533","0091288","0091480","0081375","0071853","0116587","0116212","0116886","0118147","0108598","0084589","0109781","0034493","0078875","0069198","0110521","0116059","0112483","0103850","0095765","0097108","0101700","0101765","0101811","0050825","0099703","0102014","0116209","0102426","0097937","0098724","0105107","0105488","0096257","0101026","0102370","0100332","0073486","0078446","0080684","0093779","0082971","0088846","0090605","0060196","0094336","0050083","0056172","0066921","0056592","0078788","0064116","0086190","0093191","0041959","0099685","0078748","0106308","0095250","0089881","0097202","0054215","0080455","0071562","0093058","0104361","0097499","0086879","0045061","0087843","0081398","0075686","0086197","0079944","0082096","0070735","0067185","0103130","0050976","0085859","0088247","0103873","0097441","0100519","0079522","0100150","0097165","0061722","0052311","0100263","0050212","0056801","0071315","0043456","0040897","0092610","0023969","0088794","0081505","0092005","0022100","0092991","0057115","0077416","0082269","0107048","0105695","0056218","0100436","0036613","0088763","0101921","0066206","0090967","0094625","0091203","0061512","0099334","0072431","0102536","0101640","0032553","0032455","0044706","0038355","0097493","0081534","0052618","0088258","0085809","0094006","0097576","0078841","0083987","0096332","0091867","0089886","0084503","0087553","0089606","0049223","0097351","0073341","0064115","0087884","0101458","0098635","0116589","0116293","0112537","0103644","0082010","0103678","0085159","0115535","0106262","0083550","0078767","0099030","0071233","0090655","0075704","0092632","0056869","0051418","0082083","0101492","0037549","0103874","0026138","0074258","0103919","0101540","0055824","0074285","0083722","0087800","0013442","0091651","0075005","0115710","0115495","0117057","0115751","0119791","0117731","0117631","0117666","0116705","0117293","0117372","0117477","0115988","0115433","0099423","0079945","0102975","0098382","0084726","0088170","0092007","0103776","0096487","0100994","0077631","0084021","0100114","0105690","0073195","0077766","0085750","0117119","0116996","0115906","0116695","0093822","0094155","0105435","0115633","0116621","0116999","0116410","0115641","0112769","0117571","0104691","0117038","0116477","0117690","0118163","0117091","0118100","0116250","0117364","0067959","0119731","0116506","0119115","0120550","0120390","0112362","0116704","0120414","0118708","0119664","0106535","0118928","0119644","0106266","0106387","0119937","0119640","0116790","0119225","0118111","0118691","0120238","0119887","0119141","0120357","0118548","0120317","0120434","0116922","0120036","0119008","0118750","0118702","0119432","0116743","0119951","0119572","0120053","0120152","0115964","0116041","0119528","0120094","0118972","0118829","0118663","0116931","0120389","0118623","0119013","0119381","0118615","0119229","0116783","0118541","0119859","0120032","0116295","0120461","0115886","0118655","0118771","0115760","0119109","0119116","0119809","0117398","0117615","0118556","0115744","0119567","0117359","0117561","0120118","0114303","0120373","0118787","0118880","0114134","0120179","0118688","0120034","0116502","0119282","0119738","0115856","0057345","0119094","0119098","0119654","0119848","0120512","0120133","0118884","0116930","0119173","0082198","0119190","0118887","0119081","0120177","0118570","0119896","0119361","0118818","0118883","0118966","0120207","0120112","0119311","0119509","0119675","0119695","0119086","0119484","0118571","0118531","0099810","0102494","0119465","0120197","0119360","0119051","0119874","0119488","0120102","0119468","0120169","0120524","0120323","0119174","0119123","0120399","0119632","0118647","0120402","0119349","0118842","0119164","0116631","0119280","0119345","0118971","0120029","0119906","0119324","0119107","0120481","0120539","0119177","0119095","0119891","0120257","0119535","0119338","0119080","0119210","0118900","0083131","0118689","0119592","0120490","0119527","0119978","0118749","0090329","0119365","0120201","0118901","0107282","0118836","0120148","0119707","0120382","0120520","0119723","0116592","0119994","0119395","0118617","0120483","0118583","0118607","0118632","0123385","0118698","0118804","0118954","0119137","0119142","0119217","0119303","0119668","0119715","0120082","0120222","0120255","0120338","0120347","0119925","0119314","0119396","0119485","0119718","0118715","0118566","0119590","0119223","0118539","0120820","0120885","0118929","0120696","0120693","0119099","0120122","0112913","0119815","0120185","0118956","0119734","0120008","0120594","0119784","0118747","0120888","0120184","0120782","0119822","0099939","0119594","0120873","0120491","0119574","0120661","0118744","0120241","0120744","0120769","0120890","0125454","0120642","0119250","0119942","0120510","0124179","0120772","0119305","0119905","0120598","0124295","0118851","0120738","0120749","0120176","0120632","0120728","0120773","0120765","0124718","0119196","0118819","0120906","0118755","0120725","0138563","0119987","0117786","0120265","0119448","0120841","0120742","0120609","0120856","0118925","0119683","0118866","0120647","0120800","0120685","0118798","0120669","0120777","0119053","0119313","0119375","0120401","0120787","0116692","0120828","0127723","0139362","0118849","0116141","0122529","0119717","0120762","0120902","0126344","0118998","0120780","0073540","0120321","0118789","0120591","0122151","0123987","0122718","0138704","0140688","0129387","0052077","0019729","0020629","0021746","0022958","0026752","0027698","0029146","0030993","0035093","0036872","0037884","0036868","0039416","0040416","0041113","0045793","0047296","0048356","0055614","0057590","0060665","0061811","0063385","0064665","0067116","0075148","0079417","0081283","0082158","0086425","0089755","0093389","0095953","0097239","0065063","0067309","0087995","0100142","0091369","0088847","0089686","0093629","0095742","0097981","0101917","0080761","0082418","0083972","0087298","0089173","0091080","0095179","0097388","0077651","0082495","0085636","0095271","0097474","0081383","0105179","0094862","0099253","0103956","0084516","0091778","0095889","0070047","0076009","0099528","0093409","0097733","0104714","0087363","0099700","0089218","0120746","0119910","0117898","0070723","0017136","0096874","0099088","0069113","0076054","0054594","0078790","0054649","0034492","0047478","0094947","0087182","0095497","0099674","0102757","0119558","0134619","0120741","0120815","0066811","0088814","0078869","0062737","0109287","0075807","0077305","0065566","0082199","0109520","0052722","0082263","0091059","0091149","0080861","0076137","0107120","0104437","0097523","0077698","0056095","0057180","0120768","0120783","0131857","0098213","0089853","0039689","0059113","0083922","0090203","0086423","0106273","0096734","0089126","0071910","0082736","0090756","0089385","0061852","0048280","0097757","0104868","0104940","0104990","0055254","0046183","0081353","0100477","0076618","0078158","0107952","0089908","0102803","0075200","0053285","0086336","0057518","0038969","0088161","0019422","0111359","0084783","0084827","0108265","0120694","0102250","0079367","0083798","0085894","0101969","0086066","0087469","0077869","0087803","0085407","0091499","0107665","0085382","0087050","0096787","0101272","0120631","0120832","0080388","0077711","0061184","0092513","0090305","0061584","0057372","0070016","0078480","0084649","0083791","0090633","0101329","0089469","0088128","0091790","0090060","0090848","0091223","0093220","0080801","0097443","0140796","0118661","0120703","0120831","0133413","0099763","0063522","0088323","0100240","0080391","0094077","0119517","0124595","0120611","0118301","0120901","0119778","0120692","0094721","0119033","0040746","0074512","0068611","0065112","0061107","0058329","0051207","0049470","0048750","0045897","0044079","0042994","0120577","0123324","0096446","0094226","0120654","0120724","0039694","0037017","0036342","0035279","0033922","0034248","0031505","0030341","0028212","0028231","0025452","0018328","0017075","0128442","0123755","0124879","0073817","0081207","0085346","0092699","0092537","0096463","0095593","0098258","0100212","0104412","0105629","0084938","0084472","0087810","0086973","0092225","0091680","0090583","0096073","0098625","0102558","0101523","0102469","0104257","0107211","0120788","0120776","0120812","0118736","0122690","0146336","0118863","0119802","0126604","0100594","0080731","0047573","0084787","0105151","0081554","0099487","0117276","0120587","0120823","0120770","0120889","0124102","0063462","0082517","0104952","0073440","0119577","0120701","0122642","0119670","0086837","0090830","0080678","0120603","0144120","0120791","0147612","0118636","0120789","0120157","0150230","0118799","0124819","0100740","0120877","0120586","0116481","0120722","0158493","0120684","0133952","0120484","0127536","0120879","0130018","0155753","0119643","0116488","0089941","0073747","0087932","0091954","0091538","0099750","0050783","0085244","0120660","0134067","0120623","0120533","0140888","0120070","0166396","0154420","0069089","0045826","0047034","0087344","0056142","0024216","0074751","0091344","0089017","0089087","0089155","0097366","0089893","0091159","0091541","0090264","0089489","0087928","0089822","0091777","0093756","0095882","0098105","0120595","0119304","0124198","0119248","0155975","0147004","0120324","0141109","0120844","0120794","0128445","0138097","0039628","0089961","0098115","0089767","0089880","0083944","0095956","0089370","0088011","0088933","0094890","0079817","0084602","0089927","0100507","0088930","0090357","0092173","0090685","0091188","0091653","0091024","0087538","0091326","0097647","0097958","0128853","0120706","0120863","0133751","0120751","0041650","0129290","0120686","0120633","0119336","0120857","0118564","0150915","0145734","0132512","0120710","0139699","0120458","0091225","0093075","0090768","0051622","0091064","0097368","0091875","0090660","0072271","0092076","0110978","0091877","0090917","0091605","0091306","0091738","0090555","0092493","0092105","0091991","0090863","0090567","0091187","0091055","0092086","0151691","0149151","0112922","0160862","0054167","0120784","0145893","0138987","0128133","0174852","0070544","0124298","0139462","0120764","0155776","0132477","0151804","0156901","0137338","0134273","0123209","0070334","0084390","0098084","0105128","0106557","0109415","0085333","0084412","0065377","0071110","0075648","0076636","0072308","0080354","0079550","0070909","0074812","0063442","0065462","0069768","0068408","0067065","0077189","0071455","0078856","0175550","0122933","0142192","0139134","0120735","0157208","0120646","0144814","0131646","0057129","0094964","0107626","0054443","0056931","0118665","0157016","0141098","0160429","0129332","0139668","0118892","0049408","0187819","0131369","0120757","0120613","0133093","0147800","0120274","0129280","0120449","0119665","0154506","0139239","0151738","0105399","0126250","0133363","0119219","0123964","0143261","0136244","0110570","0125659","0133189","0120836","0120797","0126886","0120907","0137494","0138510","0162973","0115669","0155388","0037913","0087799","0090837","0089652","0099422","0120616","0118826","0120865","0140379","0160298","0165078","0115693","0120915","0166252","0149723","0059643","0023245","0053085","0082766","0078346","0081573","0086393","0094074","0021814","0021884","0035899","0050280","0034398","0089308","0048696","0073629","0084156","0044121","0045920","0046534","0049366","0049169","0084745","0053183","0052151","0125439","0139809","0126859","0128278","0186508","0141105","0164085","0145660","0120802","0120855","0144214","0122541","0120731","0130827","0120370","0142342","0139898","0119038","0119743","0120554","0099052","0158983","0120891","0162677","0163651","0137363","0137439","0158811","0185937","0120663","0139414","0087332","0097428","0157503","0171363","0141369","0149261","0132347","0163187","0162830","0049406","0048254","0054331","0056193","0072684","0053198","0055032","0096378","0091557","0091129","0090774","0092585","0090886","0088939","0091343","0091637","0092068","0091613","0091699","0091530","0091419","0054033","0092534","0091554","0093818","0093051","0093690","0092850","0083967","0144168","0129167","0167404","0155267","0063688","0122515","0168449","0138946","0131325","0120620","0165710","0168987","0138487","0077663","0055304","0058333","0091178","0088889","0066765","0077394","0082377","0080339","0083530","0118604","0089670","0085995","0095188","0094737","0100419","0102719","0104740","0119843","0096244","0107798","0085334","0130121","0133046","0176269","0105698","0156887","0160401","0181833","0091278","0095382","0103617","0113438","0073802","0058175","0104839","0181733","0120657","0138304","0160236","0164108","0163579","0125971","0126810","0157183","0145531","0164181","0118843","0151582","0097050","0031762","0045251","0088146","0059297","0063823","0169547","0088178","0181316","0126916","0080491","0058182","0173390","0077280","0089175","0097390","0061385","0068473","0082348","0050814","0108185","0111419","0073812","0082511","0099558","0091431","0150377","0120716","0140397","0129884","0160338","0159421","0168172","0164114","0134618","0120188","0162360","0133122","0134033","0194314","0060095","0087188","0106664","0031397","0095652","0079714","0086154","0091799","0056443","0156934","0167427","0171804","0165854","0086200","0100802","0082089","0091042","0086617","0068699","0061747","0080179","0065571","0095270","0037558","0087980","0082979","0176093","0097223","0077405","0033804","0034240","0035169","0046126","0038559","0052225","0085549","0104507","0061578","0059260","0058150","0057076","0055928","0080453","0058461","0119256","0104431","0094008","0137523","0160916","0119114","0192194","0203408","0166896","0048977","0081633","0061138","0083946","0078754","0093206","0097123","0200469","0168501","0163988","0142201","0144640","0172627","0099710","0059319","0067527","0093870","0100502","0096438","0081150","0082398","0097742","0070328","0091829","0059800","0185371","0166943","0120601","0119698","0200849","0170705","0120596","0145681","0140352","0181288","0156729","0200071","0065088","0099180","0082121","0077355","0083767","0092796","0089885","0097240","0106856","0082427","0017925","0078087","0061407","0082817","0055630","0100475","0067525","0094012","0070608","0048380","0082484","0065988","0050371","0086465","0079540","0087700","0093516","0104837","0101669","0105130","0113416","0083254","0149691","0120655","0151137","0190641","0165773","0160620","0118150","0101605","0034862","0056197","0105156","0119908","0066473","0095675","0084855","0086856","0094027","0093565","0059674","0068762","0059646","0057187","0164312","0165859","0178737","0162661","0143145","0185125","0024852","0096061","0042546","0040522","0093509","0080979","0067411","0093512","0032551","0050738","0033045","0087781","0073692","0105265","0093010","0089360","0100680","0095631","0099077","0099291","0101393","0101889","0088007","0087921","0090556","0146675","0120363","0155711","0134154","0104114","0172396","0144715","0158371","0099165","0010040","0028950","0079239","0096171","0100828","0096328","0063056","0150216","0205000","0120689","0124315","0141974","0067328","0051337","0166485","0182789","0164912","0162866","0120910","0175880","0119079","0174204","0151568","0106455","0066892","0064276","0087231","0053226","0146838","0125664","0177789","0134119","0195945","0174856","0145653","0120866","0192335","0174268","0120834","0172493","0156812","0134983","0169302","0070903","0046359","0095897","0070511","0070290","0065724","0097162","0077269","0086859","0107659","0083929","0094924","0106364","0088707","0029606","0100318","0083851","0090366","0058625","0186975","0071935","0081748","0120662","0156639","0201840","0104187","0076095","0104797","0105417","0108147","0104389","0106246","0088683","0105323","0105793","0108525","0104694","0105112","0103855","0104070","0104231","0104454","0105415","0105665","0105812","0103893","0104684","0103905","0104815","0105477","0104291","0104040","0105046","0103759","0134084","0105414","0144117","0171356","0069754","0144801","0067433","0067848","0163978","0184907","0220099","0209189","0074455","0107920","0062376","0181984","0162983","0134847","0190138","0159272","0221023","0018773","0021749","0087265","0012349","0084395","0043618","0184858","0185014","0194368","0186045","0156841","0181151","0218043","0165798","0094347","0055471","0085980","0040506","0097372","0042276","0086969","0056875","0062793","0086005","0055353","0218112","0183523","0142688","0181530","0101698","0078902","0091217","0094812","0072890","0069704","0042208","0049730","0051411","0094731","0064110","0104057","0118043","0053137","0072251","0090274","0102138","0098645","0093148","0091400","0091934","0094321","0098309","0092834","0092666","0093596","0079588","0082474","0087755","0108526","0088760","0090219","0081400","0046435","0051994","0043379","0195685","0195714","0180181","0095800","0048316","0072443","0044517","0103074","0078718","0077975","0091939","0096054","0097216","0100168","0102175","0078950","0099317","0071402","0082250","0089003","0092857","0109578","0036775","0101787","0100758","0103060","0108308","0087985","0090693","0092675","0077530","0113133","0028944","0093105","0095238","0107050","0061735","0165929","0195778","0202402","0146516","0191043","0091142","0057261","0027977","0107091","0057163","0054997","0053946","0071411","0075860","0074718","0117468","0043924","0099871","0112950","0093378","0089457","0091445","0146882","0138749","0192614","0102057","0017416","0065126","0095564","0085919","0077928","0100157","0104928","0089643","0107630","0069293","0074958","0093640","0079640","0063374","0075029","0186151","0217756","0122459","0160797","0172632","0183503","0051406","0077572","0097940","0082031","0086927","0098067","0093773","0102713","0082934","0099014","0191754","0144084","0171433","0149367","0166175","0236216","0083833","0102898","0068327","0056687","0051383","0048140","0085701","0074860","0080487","0176783","0199725","0141926","0159097","0104549","0044837","0132910","0158622","0198021","0189584","0180837","0162348","0154421","0220100","0106521","0112634","0115834","0093185","0096324","0172495","0153464","0188674","0085276","0080913","0080923","0071772","0085970","0084315","0185183","0210616","0156323","0174336","0171359","0037514","0056048","0041716","0089791","0181786","0104438","0130623","0217630","0215129","0196216","0080881","0066495","0120755","0184894","0207998","0154443","0055830","0034742","0015864","0039631","0064757","0058576","0076752","0089960","0079574","0071807","0050598","0014624","0036824","0208003","0050095","0080365","0081318","0060371","0054953","0070130","0062168","0098143","0100438","0102728","0107899","0110916","0095977","0063518","0105466","0071230","0071206","0092638","0076044","0047673","0074486","0103767","0048347","0082252","0094980","0059578","0070355","0086979","0097322","0089841","0099582","0095525","0084522","0086129","0089826","0086143","0090849","0090190","0098503","0098502","0091630","0100403","0093894","0088172","0087004","0094631","0079501","0082694","0089530","0099141","0092563","0091635","0087262","0105428","0094612","0105316","0102951","0100046","0094882","0092710","0093011","0187078","0182295","0145503","0099726","0077362","0082009","0074156","0093605","0102592","0067741","0071360","0082220","0077588","0070509","0070666","0043338","0056195","0072226","0023622","0090728","0069762","0015648","0204175","0162650","0120913","0188030","0186253","0120630","0183505","0187393","0131704","0177971","0200669","0097100","0076257","0106469","0089118","0101846","0099797","0087727","0089604","0094792","0072288","0087175","0071569","0099800","0102065","0159382","0219854","0175142","0179116","0215369","0060176","0059575","0212974","0087277","0038499","0120903","0200530","0168794","0163676","0161081","0210234","0052561","0104299","0064615","0076716","0054749","0103241","0105813","0080310","0068555","0077742","0073312","0089276","0092048","0144528","0144201","0171865","0174480","0200550","0164052","0186566","0206226","0195234","0057603","0052646","0080472","0106627","0065938","0095863","0110823","0138703","0095925","0099005","0086320","0098384","0049189","0085470","0071650","0038975","0251739","0234853","0204709","0163983","0173716","0233687","0191397","0199314","0209958","0188640","0236388","0095705","0102510","0032881","0046303","0053318","0059017","0088206","0160009","0204946","0198386","0209322","0144964","0171580","0190798","0204626","0202677","0181875","0211938","0191037","0197384","0134630","0164212","0192731","0206420","0168629","0218839","0210567","0222850","0210075","0210945","0093177","0095294","0104409","0107209","0057887","0088184","0055608","0060397","0040068","0032234","0046876","0024184","0052969","0088024","0084695","0093996","0100639","0091990","0100663","0215545","0259974","0208988","0067128","0212338","0180093","0170691","0202641","0208874","0205271","0213790","0066832","0075754","0054387","0093091","0058708","0041094","0038988","0037638","0249462","0230030","0223897","0081376","0111512","0229260","0192255","0160127","0146984","0185431","0203019","0199753","0203230","0066995","0074452","0216216","0186894","0170016","0230591","0213203","0211181","0213847","0180073","0217869","0190332","0190374","0228750","0190865","0086993","0093748","0096094","0093428","0092106","0094291","0096969","0096219","0088850","0208092","0095927","0241303","0242423","0120917","0183659","0207201","0181536","0219699","0247196","0162222","0218967","0200720","0212346","0190590","0120202","0219653","0149624","0218182","0146309","0181865","0218378","0189998","0093223","0083564","0101757","0084434","0053580","0090670","0049233","0107007","0218817","0238948","0206275","0194218","0237572","0102388","0095690","0105165","0069897","0071517","0095348","0108451","0186589","0209475","0234805","0216800","0092545","0092546","0092605","0092608","0092618","0092641","0092644","0086960","0092654","0092690","0092695","0092718","0092746","0092783","0092948","0092965","0092974","0083907","0093036","0093044","0093073","0093093","0093186","0093200","0093209","0093260","0093278","0093300","0093405","0093407","0093418","0093437","0093467","0093476","0093477","0093493","0093507","0093560","0093589","0093638","0192111","0190524","0242998","0118694","0120753","0250478","0212985","0239948","0190861","0231775","0265632","0230838","0177650","0249893","0166276","0233142","0191636","0236493","0182000","0251031","0179626","0192071","0236447","0099073","0116447","0031742","0091836","0096223","0039190","0057251","0059245","0053793","0060086","0113026","0037800","0066740","0079781","0080421","0101764","0068617","0102005","0085868","0100140","0100232","0091474","0100486","0077413","0088000","0093857","0118540","0091860","0089208","0071771","0102517","0215750","0242445","0205873","0209144","0125022","0239949","0244970","0227538","0246989","0236784","0245712","0206187","0247380","0164334","0221027","0189192","0266860","0221889","0268200","0243155","0245686","0236348","0221073","0255094","0231402","0240515","0240402","0211492","0199129","0086250","0055895","0132245","0203755","0141907","0209163","0240913","0085811","0089504","0025913","0084917","0064940","0060429","0101912","0080539","0101902","0080319","0079638","0090098","0045464","0066011","0093713","0048021","0183790","0212826","0256408","0225071","0126029","0206742","0203009","0213149","0210727","0206917","0077716","0102343","0101587","0095082","0052902","0054130","0095647","0054047","0053221","0094142","0244316","0060934","0041996","0059885","0255798","0212815","0251075","0244244","0254099","0234288","0065528","0116344","0102685","0086508","0105699","0092272","0045810","0045891","0048605","0084805","0230011","0146316","0240462","0232500","0212720","0255819","0250224","0258038","0212517","0203119","0203632","0243493","0228786","0246765","0239395","0271027","0257106","0245238","0249380","0099012","0094663","0058953","0052216","0082136","0087032","0058249","0059124","0053925","0016847","0056217","0091886","0093940","0105378","0091983","0069372","0047811","0046754","0069467","0065777","0048261","0063227","0055184","0049513","0051036","0049966","0059095","0074991","0076786","0068767","0082176","0067824","0077594","0089461","0082869","0068935","0163862","0173840","0250494","0227445","0262210","0242193","0273300","0227005","0245280","0188913","0109049","0130445","0094593","0094594","0094606","0094608","0094602","0096764","0094675","0094678","0094712","0094715","0094716","0094739","0094744","0094746","0094761","0094799","0094824","0094828","0094889","0094894","0094898","0094910","0090887","0094921","0094933","0094961","0094963","0095031","0092929","0095107","0095145","0095169","0095174","0095243","0095253","0095304","0095409","0095484","0095488","0095489","0095519","0095532","0095599","0095638","0095654","0095687","0095736","0095801","0095963","0089907","0095993","0084296","0096018","0096071","0096101","0091949","0096163","0096251","0096256","0096316","0096320","0096454","0096486","0096794","0088708","0096913","0096928","0096933","0096943","0096945","0097027","0097044","0097138","0097142","0097211","0097236","0097235","0097257","0085475","0097289","0097328","0097334","0097336","0097438","0097457","0097458","0097481","0097500","0097531","0097579","0097613","0097626","0097635","0097637","0097659","0097714","0097722","0097731","0097758","0097778","0097790","0097815","0097858","0097883","0097889","0097965","0097967","0097987","0098051","0098073","0098097","0098141","0163025","0265029","0222851","0162346","0248845","0133152","0237539","0123948","0203540","0243655","0098194","0098206","0098253","0098261","0098273","0098282","0098308","0098343","0094035","0098725","0098436","0098439","0098471","0098519","0098536","0098546","0098554","0098621","0098663","0108539","0056868","0101465","0065761","0087089","0078490","0083624","0218922","0247638","0266915","0094868","0056059","0077288","0060668","0064782","0075213","0108323","0080360","0080377","0080402","0080436","0252866","0181739","0230600","0244000","0250202","0250323","0261983","0238112","0250687","0258470","0256524","0261392","0228333","0234829","0208196","0206926","0203166","0255653","0263488","0184791","0103596","0109015","0112255","0070917","0246544","0202470","0269341","0242587","0250809","0248912","0221218","0180734","0229340","0273253","0246464","0118589","0139654","0243759","0255321","0239986","0264578","0082416","0063032","0070294","0102316","0079579","0071994","0053559","0093677","0058092","0053877","0051773","0057193","0029081","0033836","0053143","0067588","0055312","0108473","0086312","0076172","0079766","0091993","0044207","0260866","0252501","0196229","0245891","0206314","0273799","0240890","0240419","0080437","0080464","0082100","0080474","0080492","0080516","0080549","0080556","0080610","0219965","0250310","0108148","0243255","0166924","0206963","0164917","0166110","0066999","0067093","0087666","0102555","0072979","0105601","0120681","0272020","0200027","0246628","0243017","0272152","0245674","0236019","0246578","0253126","0264796","0243133","0234988","0249478","0198781","0267804","0275719","0252503","0256380","0080130","0241527","0234354","0265087","0253798","0266987","0256009","0247425","0082558","0076221","0062994","0053472","0083630","0074899","0076342","0090095","0035140","0024264","0077321","0209037","0076299","0075824","0084809","0080661","0080716","0080736","0080745","0052564","0074483","0082350","0076070","0100054","0089622","0076535","0054135","0081568","0086383","0159273","0242252","0282856","0193560","0240772","0233841","0270259","0050539","0283509","0037515","0020697","0087747","0211915","0277371","0259711","0280778","0283431","0259393","0265666","0101452","0090852","0088103","0086346","0094318","0278488","0268397","0279889","0035423","0120737","0268995","0268978","0051525","0063415","0058672","0051201","0248667","0265086","0245046","0086619","0280707","0277027","0285742","0120824","0074937","0105789","0273923","0237534","0099044","0269746","0100530","0103129","0082288","0087078","0085542","0160399","0240468","0281373","0083511","0243862","0109288","0085271","0106770","0145046","0066026","0060955","0055257","0245844","0265349","0281358","0276501","0270933","0220627","0293416","0208990","0250081","0219405","0106223","0097116","0240900","0188453","0295552","0072353","0265298","0233469","0246894","0265713","0109190","0028988","0107985","0108037","0069995","0275022","0251114","0251160","0280030","0247745","0107034","0253200","0060200","0044391","0050306","0069281","0075276","0259288","0238546","0207524","0291341","0265343","0275067","0143861","0074174","0216651","0050986","0243736","0277434","0068273","0066830","0104254","0080057","0043983","0278295","0268695","0035015","0109855","0080836","0080889","0080904","0081060","0081070","0081176","0081184","0081809","0081259","0081268","0076489","0268380","0120804","0284490","0216799","0264761","0282864","0245574","0085154","0035262","0083169","0081420","0081441","0081445","0081480","0081506","0081529","0076729","0086325","0081562","0187738","0279781","0286162","0262432","0250305","0266452","0258000","0265662","0248190","0254686","0279065","0068309","0089167","0102103","0257756","0283111","0245407","0246134","0083590","0042876","0076723","0264472","0264616","0253867","0266391","0219822","0259446","0050086","0099892","0038890","0103035","0094137","0098966","0081738","0264935","0277296","0157583","0247586","0253840","0262911","0211443","0282687","0275309","0287645","0235737","0047892","0099204","0101701","0095186","0104466","0071746","0098513","0100934","0231448","0278823","0145487","0068326","0073043","0110157","0100196","0103247","0241760","0250797","0239234","0045591","0050634","0038589","0276751","0121765","0247199","0278500","0077523","0051758","0077838","0278435","0278504","0166813","0254199","0268690","0044916","0056406","0164184","0279493","0090570","0105219","0067756","0280486","0279778","0298798","0285441","0258463","0267913","0245562","0238924","0282768","0210065","0242508","0244479","0082146","0087042","0090021","0040823","0061770","0091472","0100135","0041866","0103184","0247444","0275847","0181689","0252444","0286179","0314166","0280590","0258273","0265591","0107438","0104897","0102573","0111653","0308506","0120912","0289408","0263725","0305396","0253556","0257044","0297721","0269499","0050084","0044744","0089798","0068156","0065234","0220506","0254455","0271367","0267626","0243585","0295178","0303353","0271219","0246500","0079641","0074205","0061810","0059557","0058888","0075147","0088286","0295427","0286106","0265930","0287717","0279113","0309377","0295701","0274309","0290823","0327036","0120263","0093780","0073631","0180052","0300532","0246772","0256276","0265459","0261289","0258153","0281322","0280424","0300453","0088885","0090799","0082186","0102059","0078350","0080025","0090966","0049452","0094025","0295254","0022599","0275688","0269095","0283026","0087507","0068833","0117883","0303714","0265808","0293662","0269329","0280760","0106315","0099128","0103924","0099512","0101821","0077681","0107212","0070350","0110557","0100666","0103003","0039111","0048281","0044829","0044876","0292542","0250258","0308208","0280460","0240510","0280380","0283832","0274497","0245171","0274812","0245429","0326306","0256415","0290095","0179098","0281364","0298388","0289765","0280491","0246677","0265307","0271259","0101898","0058379","0197521","0095895","0035211","0098575","0051554","0086373","0058230","0099581","0276816","0297037","0211465","0292644","0283084","0283139","0310793","0328962","0313487","0272338","0291502","0227984","0298130","0298744","0252480","0145937","0296166","0212604","0101453","0095327","0076666","0086361","0081696","0080031","0081693","0081764","0081964","0081974","0082045","0082085","0085327","0082175","0082200","0082353","0077533","0121261","0082370","0082382","0082405","0082431","0082432","0082449","0082477","0082498","0082677","0082755","0082763","0082782","0082783","0082801","0082910","0082926","0082949","0288477","0322802","0259484","0270707","0286261","0120679","0299117","0061452","0087075","0053804","0060921","0058756","0297181","0304669","0280665","0298203","0297884","0295297","0273435","0313196","0314725","0042895","0118735","0263734","0280609","0051745","0102368","0099669","0099266","0102782","0103112","0082970","0081427","0081455","0083089","0083163","0083190","0246460","0283530","0293815","0295238","0258068","0287467","0271263","0283160","0307479","0133240","0283632","0103959","0118767","0090368","0279064","0077713","0110308","0213121","0058777","0289848","0262396","0268126","0238380","0290329","0083271","0083284","0083557","0080393","0083629","0083642","0083686","0083702","0083806","0303933","0302640","0252076","0253754","0257360","0298856","0220580","0300214","0167261","0245929","0307901","0168786","0217505","0313737","0272207","0099160","0106453","0054743","0075968","0100143","0110613","0102492","0096283","0033152","0049934","0050147","0071222","0073115","0068575","0091814","0264464","0255477","0299658","0274558","0290210","0309912","0253474","0119273","0085794","0282698","0290538","0330069","0305711","0246498","0295289","0257568","0271668","0317248","0026056","0075675","0103671","0057869","0106500","0101748","0056023","0052918","0102500","0029453","0089981","0088414","0282209","0280653","0311320","0086978","0106833","0070155","0107079","0326769","0309593","0292506","0280720","0308514","0303361","0049291","0160611","0105622","0083943","0084112","0084210","0084237","0084266","0084329","0084335","0084352","0084422","0084469","0084504","0084555","0084597","0084628","0084633","0084648","0084777","0084786","0084814","0084854","0084899","0084945","0251127","0300471","0287978","0283426","0299458","0302674","0291579","0106701","0085248","0078872","0059573","0043961","0057581","0053172","0074851","0279331","0279111","0289992","0302886","0315543","0273982","0324080","0306685","0278731","0091374","0287471","0102303","0107563","0301429","0305669","0314353","0290673","0298408","0161860","0256359","0286499","0269347","0310357","0236640","0283003","0055047","0035417","0060182","0075995","0099776","0047030","0099699","0052948","0086087","0178868","0096028","0065054","0103036","0285462","0285531","0323642","0264150","0028597","0264395","0298814","0325537","0286788","0283897","0316188","0334416","0100998","0070460","0042593","0281820","0266465","0183649","0275277","0304328","0311519","0305224","0280477","0297144","0251736","0300140","0245803","0323572","0310281","0311289","0328099","0301727","0236027","0067800","0050177","0066769","0060390","0327920","0091396","0095613","0100611","0108442","0092214","0078504","0102465","0102849","0310910","0309698","0311110","0342275","0252684","0274711","0334405","0306841","0290334","0290145","0118926","0317226","0285861","0317303","0301414","0308878","0250067","0237993","0088915","0086946","0086999","0086998","0092067","0049314","0045963","0234215","0309530","0281724","0283900","0347791","0315327","0314786","0304081","0286516","0266543","0317740","0295700","0342172","0332639","0322259","0298228","0060748","0101020","0050972","0069895","0307197","0178022","0043067","0061170","0071143","0074281","0031225","0093267","0104743","0059711","0102603","0120142","0066279","0065134","0043137","0019760","0037954","0108330","0101410","0103791","0059183","0053841","0051878","0025456","0100211","0057427","0054428","0119215","0076240","0102456","0102900","0036377","0062362","0329028","0339034","0329717","0318283","0289043","0305357","0286635","0071141","0106447","0056415","0029808","0048947","0103747","0104926","0045125","0066402","0074811","0069495","0286716","0333780","0165982","0181852","0324133","0325980","0311429","0308476","0300015","0322659","0172156","0319524","0274166","0284850","0301199","0322725","0280696","0113533","0101635","0110364","0100053","0053084","0319829","0325703","0329575","0338459","0252299","0342167","0319769","0286947","0068240","0101831","0102202","0058265","0055256","0066249","0089901","0094764","0061177","0328828","0299930","0283883","0318411","0314630","0322330","0257076","0306734","0310149","0308508","0039335","0061132","0058715","0045274","0103888","0099819","0329101","0338077","0316356","0286112","0263757","0305206","0313911","0109369","0087425","0045888","0107504","0090103","0086525","0062467","0046438","0091830","0066434","0041546","0057215","0051381","0078721","0100814","0040725","0057413","0075066","0088944","0079073","0068361","0120472","0235060","0044741","0287969","0099040","0099731","0308808","0067445","0288045","0270980","0286476","0357470","0243232","0271211","0301470","0303785","0301684","0325258","0320244","0260414","0303816","0325805","0285823","0246592","0335266","0291350","0103957","0089222","0104647","0103285","0105839","0108592","0070510","0088993","0064418","0104850","0089730","0075261","0078908","0313792","0331468","0191133","0327137","0320691","0281686","0310154","0266489","0327850","0328589","0309820","0330602","0314412","0318202","0286244","0086541","0284262","0282674","0055031","0103882","0097728","0031885","0047472","0089424","0074119","0109129","0115561","0267287","0092603","0103786","0106375","0101507","0101516","0074256","0090859","0087909","0088967","0085959","0065207","0088272","0102945","0110759","0100514","0087062","0094138","0100928","0091251","0210070","0079576","0110169","0102768","0082000","0053593","0031593","0066344","0104695","0104321","0061809","0092717","0035575","0107692","0056291","0102460","0313443","0332379","0340377","0335563","0340468","0327056","0317676","0138524","0266697","0313542","0324216","0311648","0339579","0325055","0312549","0199626","0294357","0316465","0306047","0328880","0363589","0064505","0313670","0092532","0165832","0325655","0038661","0034409","0048956","0065531","0308383","0323944","0242653","0363510","0319343","0379713","0155722","0314331","0101862","0373175","0318155","0311113","0343121","0321442","0338188","0312528","0348836","0315733","0338135","0307987","0338094","0300556","0104237","0334029","0293088","0312848","0099365","0037635","0085426","0050307","0101829","0104265","0099615","0119167","0102943","0086567","0048452","0043686","0036969","0027075","0019254","0016641","0010323","0085615","0079240","0109951","0091167","0102004","0102034","0104427","0107148","0104452","0102070","0077745","0099938","0102216","0102266","0070849","0104756","0101316","0100201","0048424","0102598","0093692","0105104","0100404","0093793","0102721","0266308","0107156","0073650","0102443","0094072","0090022","0100449","0105211","0107927","0100485","0093936","0150662","0090142","0103030","0210358","0090180","0111477","0100935","0100944","0094332","0090350","0119807","0024025","0027630","0059903","0027948","0026942","0041594","0028333","0022286","0026714","0039566","0037120","0070239","0031210","0055798","0068182","0038348","0004972","0059229","0067372","0040724","0072417","0031971","0058586","0015163","0049096","0062765","0030287","0031455","0024034","0056575","0090110","0069097","0058571","0030637","0087892","0053146","0071129","0299977","0023027","0026071","0071524","0307385","0087544","0101745","0092925","0100087","0078723","0077578","0108656","0114086","0059043","0073582","0046911","0107387","0093207","0041090","0060908","0102511","0214730","0156096","0102818","0053320","0026778","0087280","0318374","0298845","0342804","0322589","0325710","0319061","0337741","0338466","0335119","0167260","0304415","0337909","0317910","0315983","0340855","0349205","0159365","0338337","0316396","0335013","0304229","0360139","0364930","0343135","0329691","0371280","0368913","0071577","0104181","0059712","0061089","0065911","0103827","0107750","0098987","0222812","0073906","0050706","0033553","0046487","0043915","0041498","0037382","0033717","0039302","0036244","0033149","0028346","0042369","0076578","0104009","0047528","0296042","0072730","0052080","0006864","0054393","0062803","0290879","0105810","0289879","0335559","0379557","0315824","0314498","0365957","0345551","0337579","0337917","0349825","0234940","0309987","0307109","0245943","0328538","0086955","0343660","0361925","0323872","0329388","0042619","0015400","0052738","0074121","0090738","0221344","0089153","0089421","0091828","0031385","0060420","0312329","0361467","0356150","0335345","0331953","0338096","0315297","0301357","0317648","0335438","0258816","0060827","0064793","0035753","0046187","0064118","0089393","0056704","0358349","0265208","0363988","0360009","0317842","0329767","0107473","0050839","0363547","0338013","0364045","0332658","0300051","0335245","0354766","0331632","0276919","0277941","0167190","0337697","0351977","0301976","0318974","0327679","0327247","0326977","0049833","0077402","0307351","0059797","0042327","0070644","0093582","0079219","0088680","0378194","0330793","0380615","0308488","0337563","0328107","0326856","0335121","0323033","0377092","0338526","0339419","0349169","0332452","0293007","0379217","0160184","0036515","0089092","0070034","0118845","0099762","0077914","0051077","0214388","0058083","0098061","0118996","0058279","0088650","0062512","0086034","0243664","0086006","0032943","0041386","0035567","0062229","0048445","0089015","0086984","0103939","0056241","0102467","0105327","0105217","0259153","0105017","0120711","0063285","0275773","0112130","0078966","0046268","0100050","0037536","0090927","0045012","0020640","0102011","0061391","0034587","0061439","0087635","0073012","0087951","0038854","0107529","0094713","0089114","0107617","0059592","0062480","0207805","0029850","0057197","0080297","0050613","0346336","0039066","0288439","0096321","0108171","0187859","0328802","0071970","0080120","0146455","0146247","0121804","0092117","0053976","0046085","0039808","0031047","0037365","0034172","0027260","0039853","0033852","0031398","0287839","0142032","0258760","0106936","0114720","0259685","0300274","0060841","0036027","0102035","0061791","0070518","0058700","0067140","0071249","0056412","0072913","0065738","0052847","0075936","0041699","0051808","0057565","0105121","0235327","0086637","0063611","0057611","0057358","0055499","0051365","0038669","0058404","0100260","0209077","0064689","0075784","0338564","0365376","0087003","0091083","0102800","0092906","0120199","0072856","0052655","0046807","0105159","0343168","0199683","0374546","0064806","0068638","0308379","0108327","0124207","0060522","0117658","0070379","0107247","0023042","0093137","0056541","0099612","0192657","0047849","0180748","0099399","0090888","0366532","0018455","0057495","0092593","0243508","0104346","0049363","0054462","0053611","0221111","0048308","0062794","0049456","0053779","0193253","0102820","0026174","0092494","0085478","0047445","0054494","0057840","0064030","0053619","0065466","0052893","0046478","0069947","0100258","0022111","0032617","0014429","0049949","0067350","0055601","0119630","0079833","0106307","0075612","0073076","0087957","0107843","0100112","0017765","0073396","0105706","0021890","0330229","0033874","0029192","0035019","0046816","0039192","0079116","0040662","0298148","0319262","0350028","0367085","0367790","0332375","0304141","0297284","0363226","0296572","0356634","0327162","0391225","0374900","0101746","0085461","0106877","0093175","0314431","0055100","0110857","0077235","0099166","0063759","0047542","0020827","0100129","0093871","0078766","0041841","0047577","0027300","0047885","0170259","0065889","0039040","0041452","0036777","0046963","0040495","0390521","0033774","0056119","0032851","0037988","0053114","0054188","0042041","0044008","0100133","0059037","0204137","0071565","0091209","0044030","0289944","0022913","0008133","0075222","0020641","0022835","0327437","0364725","0362227","0377752","0381707","0348593","0332280","0338512","0352277","0028772","0064100","0272045","0243135","0342213","0339840","0099851","0168122","0104810","0230512","0250468","0087910","0104573","0078163","0029870","0024803","0152930","0295721","0388473","0014341","0086873","0039370","0093693","0053622","0056732","0361596","0093886","0059125","0217788","0087597","0316654","0381681","0349683","0357413","0356470","0343818","0390221","0056196","0095468","0372183","0327554","0359423","0023563","0032475","0049902","0047216","0069280","0039169","0040613","0029284","0093744","0038776","0040806","0103007","0057091","0072848","0243609","0055572","0090729","0057171","0346091","0064840","0173772","0035432","0039017","0059749","0035317","0038259","0038494","0368008","0167456","0368447","0333766","0275083","0060438","0369339","0361841","0345061","0096336","0366551","0368933","0337960","0370263","0361309","0364751","0204313","0083652","0366174","0324127","0374330","0241025","0338325","0324554","0071115","0063803","0078763","0046521","0337921","0318627","0339412","0346156","0360201","0361620","0356618","0318462","0365748","0044509","0071877","0089560","0076504","0103594","0078935","0307453","0349710","0356721","0361696","0316732","0390384","0368658","0358135","0372588","0349416","0380609","0046874","0048563","0061655","0090985","0103783","0390022","0390538","0364343","0340012","0252028","0391198","0375173","0375063","0361862","0383694","0365183","0396705","0360130","0387564","0350258","0337876","0317705","0274407","0338348","0362269","0387575","0367479","0317198","0308644","0368891","0275491","0345950","0346491","0388419","0390299","0376541","0327919","0385004","0349903","0359013","0403910","0051516","0072272","0088979","0106912","0032635","0364517","0391024","0014142","0015324","0015841","0015881","0018037","0019421","0020530","0021079","0022718","0023427","0023948","0024069","0024844","0027652","0027884","0027996","0028683","0028691","0029604","0030241","0031867","0032145","0032701","0033712","0035238","0035415","0036506","0037077","0037094","0038574","0038991","0040308","0040525","0040876","0040919","0041587","0042200","0042646","0042804","0047522","0047677","0048393","0048434","0052278","0053115","0053168","0054144","0055233","0055728","0056058","0056262","0056264","0056905","0058213","0058430","0058530","0058946","0059026","0059418","0059798","0060107","0060138","0060153","0060802","0061101","0061882","0062136","0062138","0062374","0062687","0062759","0063665","0063829","0065772","0066214","0066565","0066601","0067023","0067355","0067866","0068503","0069865","0069945","0070698","0070842","0071269","0071464","0071571","0071615","0072901","0073018","0073179","0073580","0073820","0074084","0074559","0074605","0075223","0076141","0076451","0076843","0077559","0077655","0078062","0078252","0079261","0079489","0081874","0083480","0085255","0085404","0085474","0085482","0086491","0086994","0087065","0087225","0088117","0088275","0088461","0088727","0089006","0089110","0089374","0089869","0090056","0090319","0090557","0090856","0091670","0092263","0093066","0093171","0093412","0093777","0093978","0094357","0094791","0095050","0095444","0095655","0095715","0096386","0096639","0097814","0099018","0099329","0099426","0099654","0099864","0099902","0099951","0100029","0100280","0100339","0100685","0101254","0101258","0101420","0101786","0102015","0102164","0102293","0102395","0102587","0102609","0102744","0103516","0103923","0103950","0104652","0104663","0104670","0104802","0105391","0105402","0105682","0105764","0106341","0106356","0106950","0107612","0108170","0108188","0108941","0109552","0109838","0110200","0110442","0110612","0110917","0112040","0113556","0113617","0113824","0114563","0115940","0116835","0117407","0118308","0118760","0119237","0119794","0120131","0120570","0120604","0120801","0120860","0123865","0124901","0127357","0130414","0145600","0146402","0158131","0161292","0164961","0165662","0169590","0169858","0177262","0177858","0181627","0183869","0206036","0207275","0209463","0212712","0230025","0233298","0235198","0235618","0239655","0239894","0250223","0250440","0250491","0250934","0260991","0265651","0269389","0270688","0271946","0273517","0275230","0276830","0283877","0284837","0285005","0285492","0286751","0290661","0293715","0298482","0298504","0301167","0302585","0304262","0308152","0310775","0311361","0312843","0314979","0318081","0318403","0320193","0323807","0328832","0330099","0330500","0331811","0334541","0334965","0337103","0337824","0337930","0338763","0339135","0339291","0340477","0342492","0344510","0345549","0347246","0347618","0351817","0352343","0353489","0355987","0361462","0363532","0363579","0364385","0364569","0365190","0365265","0366292","0366627","0366777","0367093","0368909","0369060","0369702","0371246","0372824","0373283","0373861","0373926","0374102","0374277","0375073","0375104","0375912","0376968","0377062","0377091","0377109","0379225","0379593","0384819","0385017","0386064","0387412","0388789","0388888","0389326","0399877","0405296","0405821","0418038","0405159","0361668","0395169","0367594","0423866","0362270","0338751","0293508","0363473","0361127","0385267","0290002","0364961","0369672","0379889","0396592","0345032","0390123","0375210","0365885","0081063","0092035","0040458","0090037","0098042","0104804","0070246","0326208","0373024","0034167","0310203","0076929","0352520","0401233","0076363","0357277","0376105","0393162","0029942","0026421","0054248","0353969","0109402","0363163","0398712","0368578","0369226","0382077","0357507","0372532","0417791","0408664","0362590","0079095","0054407","0106761","0046451","0363290","0054847","0347149","0348121","0184526","0386588","0327210","0361411","0360486","0362165","0317132","0424227","0058997","0403358","0024601","0331933","0373074","0288330","0104139","0075194","0072281","0073639","0373981","0039417","0422093","0257516","0395699","0377471","0424129","0340163","0358082","0101590","0017739","0087835","0058886","0025919","0051378","0377713","0076245","0345853","0396652","0378947","0347540","0385307","0372237","0367631","0430289","0374639","0040202","0060277","0292886","0102095","0109936","0110008","0119472","0048801","0064451","0096409","0113799","0424565","0357110","0401792","0388500","0318649","0332047","0356999","0070022","0076085","0093488","0274155","0376717","0074806","0235712","0386342","0022183","0063821","0040497","0056111","0000417","0075404","0319970","0055805","0371724","0384806","0277909","0384369","0079180","0403537","0362004","0391304","0388183","0413845","0329774","0320661","0397065","0375679","0370986","0089601","0177747","0028216","0090248","0387892","0019777","0342272","0379357","0342258","0121766","0384642","0369735","0337721","0055913","0351283","0106233","0438205","0449086","0398165","0384504","0352248","0403508","0355702","0436727","0356910","0424774","0338095","0388139","0184424","0043949","0372784","0399102","0380623","0384488","0400497","0418819","0374536","0436724","0415978","0395125","0420251","0408777","0106613","0031060","0407304","0428803","0376108","0382628","0411270","0120667","0436613","0396269","0361693","0410097","0099740","0330111","0399201","0408524","0395584","0403217","0368089","0405325","0382992","0417001","0436078","0060453","0193364","0379786","0412019","0098019","0043362","0377818","0406650","0418773","0367652","0397101","0430105","0326905","0381505","0427312","0089839","0396184","0361715","0047834","0049830","0405422","0421239","0387898","0133385","0091341","0361089","0355295","0401244","0402901","0387131","0388482","0425123","0377107","0399295","0384286","0404030","0318761","0385690","0095403","0386005","0032536","0436971","0419706","0421054","0348333","0402022","0087289","0350261","0399327","0430651","0080149","0404032","0408790","0121164","0385002","0399146","0380599","0388980","0379725","0385700","0403455","0378109","0366780","0312004","0373469","0456912","0095467","0032194","0424024","0402057","0367555","0380389","0092240","0388125","0367089","0417217","0388795","0368709","0395972","0433383","0418647","0421238","0432291","0338427","0371257","0386140","0384680","0432348","0387514","0330702","0436058","0425661","0342735","0365686","0418763","0371606","0419677","0424205","0069005","0098532","0200768","0433400","0365737","0328132","0398017","0381966","0414387","0416315","0435625","0330373","0358273","0294870","0406375","0401085","0422528","0411195","0400525","0443295","0375920","0065143","0416320","0445620","0363771","0360717","0397535","0356680","0285175","0061847","0202559","0365485","0473107","0392465","0060474","0419294","0408306","0395251","0407265","0398375","0452598","0369441","0267891","0402894","0413015","0066498","0091455","0116075","0402399","0370754","0057812","0059673","0444608","0451094","0338075","0414852","0450278","0456554","0375154","0385726","0408985","0443536","0401855","0433116","0140883","0089913","0085127","0142181","0240200","0426578","0412080","0416496","0423409","0383393","0417433","0421729","0396752","0114745","0414982","0437777","0425598","0421994","0383216","0381971","0408345","0455857","0449061","0349467","0380817","0397313","0466342","0404390","0370032","0397078","0454919","0450232","0427229","0491703","0438097","0384814","0434409","0454945","0427944","0419749","0454848","0468565","0429591","0110329","0113636","0116861","0458242","0454841","0393735","0436864","0405094","0057697","0446046","0436231","0061996","0425210","0441909","0437800","0263124","0441796","0430912","0393109","0225481","0383353","0493459","0439815","0437863","0386741","0416331","0436331","0404364","0424880","0016914","0456396","0312318","0362120","0424136","0420087","0443632","0405469","0384537","0465142","0434124","0427954","0317919","0449089","0475276","0430634","0429573","0398027","0327084","0364955","0409182","0382625","0376994","0452594","0438315","0317219","0404802","0425055","0410400","0466909","0457510","0410297","0389860","0458352","0383574","0463034","0424345","0452637","0465624","0422720","0489037","0497116","0101545","0475293","0428649","0426627","0446059","0463985","0455499","0478209","0105187","0348150","0468094","0443496","0422861","0449059","0040338","0449467","0369994","0492506","0064040","0079759","0430304","0385880","0417148","0457513","0415306","0477347","0469641","0420223","0430357","0454921","0455967","0429589","0479884","0430576","0402910","0448075","0462590","0383060","0452039","0468489","0428856","0410764","0418455","0433412","0384793","0074442","0039211","0443543","0436697","0486551","0445990","0417225","0048980","0473753","0032339","0097702","0436689","0450345","0460989","0464196","0427969","0475944","0434139","0423169","0387808","0486358","0456470","0419198","0414993","0109440","0354899","0387877","0380066","0421206","0382357","0799954","0472043","0454824","0493430","0405676","0435623","0443453","0457430","0406816","0400717","0462519","0407887","0420294","0424993","0439289","0483726","0419946","0420609","0074291","0024966","0426459","0404203","0814075","0455590","0478049","0367027","0206634","0482571","0418689","0475169","0489270","0437232","0853096","0424095","0396171","0452681","0104905","0401445","0811136","0470765","0486585","0420901","0381061","0366548","0454987","0453467","0308055","0499603","0457939","0433387","0460792","0000439","0365830","0762121","0450259","0413895","0449010","0479143","0422295","0046889","0443431","0446755","0758794","0343737","0443489","0463998","0783612","0460829","0464049","0465551","0398913","0473444","0452624","0498380","0454082","0775539","0482546","0808146","0489327","0045081","0043918","0772193","0426883","0455960","0457655","0398808","0453453","0369359","0473434","0473308","0058578","0395495","0475394","0397044","0799949","0425430","0490084","0367959","0477051","0469754","0380268","0382932","0401711","0469263","0423505","0482527","0396042","0118414","0450340","0259324","0401997","0778661","0758766","0481369","0499554","0462200","0476735","0432402","0425112","0465188","0112681","0435705","0454776","0264323","0443706","0425379","0106336","0036154","0486946","0416449","0475937","0477095","0768212","0482088","0468492","0416508","0433416","0770772","0477071","0455760","0490204","0475355","0822854","0800069","0453556","0389557","0427470","0445934","0422774","0462322","0444682","0396555","0419434","0076584","0448134","0462338","0060345","0486822","0455326","0450188","0488120","0452702","0419843","0453451","0435670","0772178","0413300","0338216","0329737","0075610","0856008","0095583","0458364","0851578","0409904","0480025","0491747","0478311","0427327","0463854","0087578","0762111","0413267","0907657","0449088","0470705","0780571","0455596","0412915","0444628","0497137","0455362","0460740","0496806","0465203","0177242","0498353","0842929","0079453","0079946","0423294","0486576","0479500","0457572","1028528","0462504","0473709","0449851","0490822","0430484","0386032","0829459","0450385","0795368","0337978","0762114","0413099","0418279","0373889","0762107","0432289","0042286","0832903","0445922","0787475","0486655","0462538","0897361","0481141","0423977","0440963","0478116","0362225","0829482","0412535","0293564","0462396","0424823","0815244","0431197","0477078","0462244","0427392","0489237","0373883","0804461","0841044","0923752","0804540","0437857","0784972","0810988","1077258","0381849","0465602","0811106","0116441","0783233","0800022","0454931","1032846","0912593","0476964","0478134","0465436","0469184","0455782","0765443","0492499","0831888","0452643","0480269","0409799","0432021","0419984","0452625","0758758","0492956","0808357","0484562","0408839","0480242","0838221","0498399","0414055","0465538","0857265","0805564","0389722","0452623","0790804","0758798","0443680","0360323","0808417","0421082","0866437","0454864","0779982","0880502","0890870","0912583","0912592","0861739","0388182","0765429","0389790","0292963","0401383","0477348","0799934","0496328","0039402","0426931","0756683","0891527","0442933","0405336","0910873","0113264","0284363","0884328","0461770","0465494","0211933","0385752","0480249","0952640","0471711","0757361","0368794","0775529","0804555","0464141","0467406","0762117","0765120","0847817","0825232","0419887","0810823","0477139","0408236","0465234","0469494","0472062","0758730","0841046","0450972","0489458","0490579","0760329","0991178","0431308","0988595","0795493","0986264","1032856","1038988","0460780","1060277","0422401","0099753","0385586","0808506","0486578","0880578","0462499","1073498","0489282","0780607","0411477","0780536","0070904","0901507","0780622","0770752","0489099","0832266","0485851","0443274","0416236","1023481","0467200","0839980","0425413","0854678","0463027","0997047","0443649","0200465","0483607","0451079","0808279","0813547","0416044","0912599","0811138","0848557","0472160","0870090","1166827","0902272","1094594","0453548","0988108","0468569","1023111","0817538","0481797","0478087","0858479","0827521","0379865","0881200","0388556","0489281","0893382","0856288","0410377","0963794","0800039","0426592","0421073","0857191","0481536","0875113","0811080","0865556","1045670","0815241","0892899","0845955","0845046","1111833","0425326","0871426","1091617","0926129","0371746","0866439","1012804","0936501","0460791","1033643","0974959","0482463","0499448","0942384","0830558","0367882","0435706","1000774","0482606","1151309","0490076","0441773","1000771","0812243","0960144","0758786","0089847","0460745","1078188","0491162","0949731","0800080","0889588","0910970","0493464","0448157","0425061","0913445","0964587","1054485","0846308","0479468","1082886","0492784","1093824","0960890","0064349","0870211","0795421","1064932","0479528","0060550","0373051","0765476","1050160","0492486","0800241","0929629","0409459","0952682","0472205","1117385","0838283","0443701","1155592","0063230","0765458","0964539","0801526","1039652","0819714","0096126","0859163","0805570","0978759","0497465","1117563","0783608","0910936","0425637","1018785","0411475","0810900","0942385","1185834","1029120","0490181","1185616","1139797","1104733","0452608","0852713","1031969","0963807","0790686","0906665","1172206","0887883","1213644","0364970","0988047","0392878","0831887","0472027","0814022","0401808","0457275","1034331","0947802","0995039","0353324","0800308","1282036","1059786","0455538","0981227","0047682","0929425","0864761","0913951","0279077","1084950","0758774","0970411","0006333","0467197","1007028","1175491","1046163","0383028","0416212","1190617","1063669","0090182","0963743","0482572","0469903","0280453","0871427","1032755","1054486","0910812","0479952","0861689","0824747","0898367","1010048","0830515","0430922","0976060","1130988","0128996","1016290","0772181","1055366","0387736","1132626","1135985","0851577","1014775","0059320","1068646","1031280","0455824","0397892","1013753","1099212","1172571","1129442","0369436","0914798","1129423","0465502","0233044","0986233","0450314","0897387","0828154","1118511","0970416","0892255","0374569","0918927","1205489","0870111","0976051","1121794","0814314","1125849","0421715","1068680","0985699","0983213","0449040","0953318","0960731","1024715","0959337","0212579","0094754","1152758","1024255","1034303","1332128","0822832","0876563","0027664","0407384","1220719","0420238","0901476","0447166","1259014","1179891","0850253","0480669","1135493","0834001","0494238","0105251","0110982","1114740","0472198","0815245","0462465","1020530","0327597","0465580","0963178","1001508","1079444","1054487","0814685","0492931","1265998","1069238","0489235","1201167","1213019","0208629","1176740","1023490","0758746","0901487","0838232","0102802","1227926","0465430","1155056","0926063","0492044","1135487","0448011","1132620","0862846","1287845","1124039","0892782","0765432","0490086","0494277","1157605","1197628","1091722","1093908","1234541","0026676","1013752","1226774","1131729","0974661","0361748","0473705","1226271","1121931","1182345","0962736","0458525","1127715","0796366","0460810","0079718","1326972","0393597","0278736","0924129","0808151","0070653","0787470","1032819","0489049","0438488","1078912","0476991","0844286","0038823","0478724","0821642","0169880","1127180","1049413","0485323","1083456","0910905","1119646","0443559","0870984","0479760","0415679","0119620","0106827","0479162","1278340","0457400","0780567","1111422","1277737","1041829","1045778","0073260","1389762","0887912","0910847","1135092","0772251","1055369","1014762","1178663","0821640","1152836","1080016","1131748","0285627","1078588","0475298","1295071","1022603","0889583","1146438","0417741","0075572","0901481","0470055","1054606","1278293","1334537","1194238","1148204","1142988","0844479","0971209","1136608","1135503","1198138","1075417","1114677","1046173","1160368","1029235","0028510","1117666","0923811","0848281","1092633","0452694","0830570","1151922","1032815","1331064","0436339","0103962","0964185","1172570","1229360","0865559","0105643","1127896","0116607","1311067","1305806","0472033","0910554","1149362","1384590","1000764","1188729","0048394","1234548","1323925","1131734","1130080","1225822","1144884","1034032","0844471","1385912","1286537","0051380","0762073","0810784","0450336","1179904","1262981","1087578","0041842","1313104","1019452","1174730","1071804","0985058","0419724","0862856","1172233","1058017","0986263","1156398","1018818","1174732","1035736","1333634","1078940","0902290","0386117","0126388","0808399","1197624","1075110","0978762","1186370","0471041","0037193","0014646","1193138","0096880","1233227","1128075","0450405","1300851","1190536","0475783","1161418","0432283","1067106","1286130","1134629","1425244","1190080","0929632","1095217","1259571","0298296","0790712","1186367","1242422","0120786","1543920","1526300","0765010","0878674","0878804","0238414","1247692","0976238","0762125","0358456","1315981","0380510","1057500","0780521","0119872","1314228","0007361","1461312","0499549","1230414","0988045","1263670","1231580","1407050","0096142","1226681","0403702","0433362","1028532","1216492","1037705","1343097","1235166","0976246","1107860","0806027","0110419","0049607","0472050","0092501","0485976","1320082","1182921","0463872","1190539","0082727","0058536","0918511","0443676","1187043","1038686","1185266","0054176","0098692","1185416","0105438","1187064","1045772","0092571","1278469","0056903","1172994","0817230","0780653","1130884","0844330","1216487","0814255","1385867","1139328","0485601","1273678","1186830","1220220","1247640","1352852","0282744","0455407","0989757","1512201","0808510","0068519","1245112","0368226","1014759","1433540","0947810","1179034","1235124","1234654","0815236","1289406","1403981","0445939","1323045","0116401","1104083","1305583","1038919","1151359","1247704","0057318","1053424","0795351","0765128","1135525","1231587","1216496","0892769","1181927","1149361","0800320","1250777","1279935","0401398","1583323","0314121","1033467","1017451","0884762","1321509","0862467","1196141","1039647","0445953","0480255","1294226","1336617","1467304","1587707","1228705","1470023","0090206","1056437","0381940","1179056","1341167","1210106","0118528","0955308","0307076","1368116","1355599","1196204","1120985","1103153","1462758","0472562","0473075","0878835","1081935","0397612","1261945","1226229","0914863","1212436","1017460","0892318","1258197","1075747","0429493","0435761","0993779","1399683","0063557","0269743","0892791","1179794","1144539","1325004","1191111","0938283","1217616","0416716","1308667","1424381","1333667","1323594","1375666","1375670","0963966","1013743","1155076","0842926","1273235","1248971","1569923","0944835","0060161","0485947","0427152","0352465","1227536","1386932","0493949","1205535","1386588","1522863","0437405","1320253","0446029","1424797","1220214","0464154","1179025","1194263","1285309","0142235","1320244","0284492","1440728","1117523","1183276","0889573","0985694","1322312","1220634","1428453","1285016","0062043","0840361","1282140","0879870","1049402","1356864","1067733","0817177","1027718","1219342","0804497","1251757","0023753","1228987","1727587","1028576","1314655","1414382","1055292","1584016","1182350","1423995","1645089","1470827","1334260","0775489","0886539","1612774","1116184","1559549","1566648","1245526","1340107","1465487","1536044","1600524","1212419","1156466","1477076","1231583","1542344","1001526","0947798","0041497","0477080","1126618","1020773","1458175","1421051","1164999","1467273","0926084","1504320","0398286","1326733","0964517","1403988","1316536","1194417","1611211","1213648","1564585","1152398","0758752","0980970","1243957","1401143","1270835","1175709","1403865","1104001","1341188","1423894","1172991","0061597","1588170","1488163","1433108","1319718","0935075","0011541","0970866","1320261","1517252","1126591","1568921","1465522","1302067","1371155","0990407","1023114","1032751","0479997","1426352","0409847","1217637","1620446","1391092","1578275","0032410","1740047","1219289","1683876","0860906","1242432","1422032","0039502","1781069","1411238","1189340","1699114","0021910","0063186","0050832","1401152","1477837","0377981","1320239","1499666","1092026","0069738","0238883","1366312","1502404","1192628","0810922","1590089","1385826","0472399","0480687","1034389","1464540","1217613","1474276","1510938","0061199","1305591","1618435","0072410","0093146","1555149","0411272","1564367","1664894","1486185","1464174","1512235","1740707","0945513","1229822","0978764","1487118","1334585","1424432","1701991","1591095","1640459","1606392","1263750","1560139","1650043","1220888","1411704","0820096","0450827","1436045","0993842","0078588","1194612","0094939","1179947","1334512","1262416","1436562","1527186","0800369","1421373","1190722","0480239","0927619","1492030","0405455","1067583","1223236","1416801","1596343","1347439","1013607","1255953","1596346","0491152","1478338","0822847","0055198","1298650","1605783","1527788","0478304","1411697","1528313","1176724","1265990","1478964","1441912","1533117","1302011","1270798","1440292","1307861","1531663","1532503","1650062","0115658","1133985","1340773","1396218","1284575","1399103","1583420","1240982","1742683","1135084","0312941","1222817","1499658","1216475","1253565","1934231","1764726","1067774","1201607","0780504","0458339","1570728","1563738","1540133","1449283","1714208","0069518","0323250","0472181","1632708","1360822","1297919","1230385","1637706","0120240","1500491","1318514","1687281","1488555","1454029","1622547","1455151","1622979","1268799","1270761","1438176","1549572","1403177","1464580","1226753","1657507","1621444","1189073","0816462","1104006","1316037","1716772","0873886","1417592","1742650","1633356","1598778","1210166","1560970","1632547","1825918","0844794","0848228","1340800","1832382","1571222","1291584","1124035","1788391","1448755","1242599","1306980","0459748","1655442","0041414","1520494","1675192","0058652","0086907","0433035","1068242","0905372","1533013","1204340","1441326","1242460","0497329","1509767","1637688","0466893","1692486","1615147","1778304","1582248","1634122","1600195","1440345","1723811","0770703","1614989","1672723","1784538","0448694","0471042","1616195","1646980","0983193","1510934","1847731","1113829","0970179","1253864","0810913","1972663","0685628","1033575","1758692","1204342","1324999","1568911","0376136","0945571","1239426","1071358","1181795","1366344","0477302","1124388","0109162","0371552","1402488","1430607","1634136","1308729","1764651","0084701","1392170","1345836","1194173","1515091","1372686","1625346","1598822","1229238","1389137","1568346","1093357","0042665","1615918","1251743","1720616","1682246","1524137","0083318","1787660","1710396","1007029","1541149","1336006","1496025","1601913","1568338","1726738","1506999","0780002","0896872","0995036","1772240","1214962","0485985","1410063","1675434","1598828","1594562","0064714","1703199","1706593","1596365","1802810","1645080","1955162","0439553","1599348","1606389","2112999","0203612","2011971","1996264","1509130","1397514","1439572","0249131","0057859","1071875","1073510","2033193","2040264","1129427","0098769","0056171","1805297","1705773","1530983","0100409","1838544","1636826","1482459","1053810","1591479","0383678","1596350","0401729","1456635","1535970","1232829","1588334","1592525","1680114","1477109","1772925","1667307","1441952","1646987","1683526","1034314","1610996","1605630","1899353","1259521","1912398","0383010","1486192","0417349","1307873","1667353","1440129","1412386","1605782","1682181","1435513","1401113","0052587","1195478","1621045","1327194","1656190","1077368","1641385","1657299","1434447","1645170","0490048","1409024","1735898","1748207","1298554","1430626","1446714","2040560","1704573","1196340","1592281","1655460","1748122","1567609","0934706","0763831","1862079","1277953","1742336","0142251","0142249","1398941","0142248","0142240","1217209","0118692","1292594","0142233","0143808","1586265","1859650","1611224","2008513","1336608","1307068","1245104","0455565","0479113","1637725","1915581","0142237","1125254","0142241","0142242","1598873","0948470","0142238","1667889","2125435","1615065","1313113","1078933","0131409","1568341","1820723","1298649","0283851","1602472","1726669","0285036","0142234","1137996","0216621","0058154","0248808","1839492","1386703","1924394","1630637","0142245","0142247","0142232","1235841","1074638","0057286","1790886","1990181","1535438","2125666","1623288","2023453","1441940","2076781","1547234","1462769","1212450","1714203","0106104","2125608","0365651","0114182","1619277","2028530","1840417","1981677","0770802","0114308","1276104","1232200","1990314","1855325","1710417","1560747","1343727","1855199","2105044","1659337","2106476","2076220","1397280","1582507","0319901","1638328","1658837","1592873","2053425","1183919","1142977","1922777","0376921","0837562","2014338","0054325","1024648","1931533","1872818","1886493","1649444","1597522","2109184","1712170","1371111","0424755","0938330","1648179","1655416","1764234","1966604","1866249","2063781","1772341","1045658","1907668","1781769","0454876","1258972","1713476","1900893","1753968","1942884","2313197","0443272","1493157","1545106","1673434","1715873","1234719","1446192","2006040","1667310","1531901","2388725","0079315","0080623","0975645","1798188","1483797","0086605","0089177","0066798","1979172","0903624","1477855","1241017","1790885","1925431","1588173","1901040","1540128","1694020","0790724","1853728","1758830","0097550","0113376","1649419","1707386","0115813","1047540","1783732","0230534","2091473","2181931","1244666","1572315","1321870","1491044","2396224","2166834","2366308","1762248","1549920","2084989","1770734","1806234","1911553","1333125","2152198","2023690","1428538","2274356","1853643","2153963","1374992","2081437","0165623","1389096","2053463","2024432","1935896","1559547","1606378","1711425","1702439","2092588","2375605","1659343","0765446","2209418","0882977","2387433","1954701","2017561","0100107","1351685","2258858","1663636","0051850","1583421","1682180","1623205","0481499","0790628","1911644","2302755","1763303","0427531","1817273","1935902","1745862","1517260","1814621","1288558","1924429","1986843","1483013","1507563","0453562","2140203","1433811","0903135","0061549","1980209","1325753","1977895","1525366","2027128","1462900","1245492","1300854","2055765","1935179","0152183","1551630","0075202","0762138","1343092","1408101","2234155","0462246","0076391","0070233","1602613","1951261","1905041","0848537","0078937","0389448","0007264","0078938","1489167","2347569","1731697","1291580","0262240","1091863","1815862","1670345","1857842","1727388","2094064","0770828","2179116","2184339","1879032","2396566","2132285","1453405","1978524","1776196","2103217","1935065","1663662","2465238","1924396","0391728","0816711","1535108","1690953","2334879","1213663","1893256","2404463","1210819","1829012","2450186","1877797","1714206","2265534","2724064","2523852","2205697","0103978","2334649","0790736","2375574","1457767","1860353","1430132","2265398","1821694","2234025","2053423","1272878","2334873","2358891","0181947","2510998","1854564","2017020","0469021","2016940","0346578","1723121","2191701","1650554","1411250","1691917","2545118","2013293","2357129","1327773","2294677","2194499","1494772","1853739","2546038","2167202","0211653","0093820","1454468","1486834","2245195","1392214","1985019","2226417","1979320","2404311","2370248","0097081","1758795","1844203","1821549","2390361","2229499","2027140","0432232","2332579","2274570","2364841","2278871","1985966","1535109","0166960","2002718","1450321","1211956","0062457","1939659","2708946","2193215","2187884","1825157","2024544","2017038","1731141","3063516","1981115","0790636","2304426","1204975","2431286","0816442","1951264","1170358","1335975","2387559","1196948","2147048","2779318","1743724","2294629","2042568","0993846","2312718","2304771","0860907","1462901","3089388","1800241","0359950","1798709","1381512","0188504","1091191","2140373","0130377","1321511","2969050","1229340","1706620","0070861","0086723","0060584","2345567","2166616","1292569","2458106","2987732","1247667","1661382","0465657","1714915","2227830","0110420","1847548","2295196","2263944","2325002","2309021","0142244","1937118","0142250","1408253","1205537","1840309","1094249","1816518","1714833","1418377","1609479","1937390","2316411","1186373","2177771","1490017","1234721","2172985","2382009","1545660","2406252","1878942","2333804","1837709","1937133","1559038","2511428","0328955","1978532","1826590","2278388","2073520","1349482","1800246","0816692","2172934","2193265","2024469","1407052","2591814","1253863","1385956","2212008","0864835","1441395","2369135","2355495","2771372","2170299","3210686","2268617","2409302","2955316","1843866","1959490","1821658","0188766","2059171","2281587","1801061","3203290","2390962","2265171","0106475","1872181","2234003","2388715","2528814","1179031","2357291","2246565","2258345","2209764","1870419","2203939","2828996","0279967","1430612","2692904","2004420","3600760","3014666","2872732","1877832","0831387","2463288","2359024","2883512","2309961","1086772","1980929","1587310","2784512","1483324","2301592","2557490","1631867","2381249","1079372","1647668","2429074","2402085","2996648","2560102","2582846","2112281","2172584","2294449","0455944","1646971","2562232","1065073","2239832","1742044","0119781","3268458","2109248","1605717","2398249","2357461","2980706","2103254","1677561","2321549","2582802","2267998","1294970","2103281","2377322","2465146","1956620","2884206","2975578","2015381","2910814","2333784","1267297","1972571","2581244","2402603","2473602","2870756","3504048","2980648","3139086","1967697","2503154","1617661","1291150","2048770","0127710","0435651","2140577","1396523","1924435","3097204","2383068","0458481","1355630","2737050","2866360","2870612","2756032","1682186","2980592","3169706","3177316","1600196","2920540","1571249","0430916","1790864","2994190","0365907","2034031","0121731","1621046","3042408","2576852","1371150","0208502","2179136","3099498","1626146","1528071","3322940","2140619","0829150","2494280","1971325","2326612","2397535","1639826","0379000","3416742","2911666","2556874","1872194","1778338","2713180","2720680","2170593","2509850","2872718","2245084","2262227","1638002","2669336","0470752","0077292","3043542","2459156","2175842","1883092","0103961","2802154","1460743","2249221","2991224","2870808","2968804","2043932","1966566","2832470","0030947","2036416","1273207","2084970","1791528","1798243","1951265","2751310","1528100","3011894","0099878","0102940","2096672","2064968","3128900","3534838","1055300","2980516","2986512","3455224","0484439","1865505","1390411","3762944","0369610","3106868","4044364","3759416","2402619","2170439","0104135","0214641","0115650","1911658","2614684","1355638","3316960","1109624","4046784","2100546","1567437","0091364","2304915","1274586","1865393","0117238","2543702","1216491","0972785","0200215","2130270","2310332","1020072","1809398","2261331","1782451","2139555","0906325","2017486","2326554","0424934","1599351","3612616","2305051","2784678","3823690","1126590","2180411","3179568","2788710","2802144","2290153","2692250","1343740","2280378","1121096","3788052","0076360","0910885","2061702","2338151","1823672","3674140","3560686","2446042","2717822","0017271","2452200","1340138","2246779","1503646","0095330","3837196","1164647","3132738","0105606","0324941","3138104","2570858","3264102","3235888","2561546","0056912","0055831","1717578","1254947","0988083","2215489","0472602","0408828","1935929","1127205","0061557","2761578","0117223","1392190","3195644","2488496","2638144","0803096","2395427","1790809","0974015","0478970","1502712","1431045","1825683","4154756","3501632","3896198","3498820","1211837","3385516","2250912","2113659","1439235","0117942","0041190","2379386","3442006","1705115","1429433","0074739","1698647","0063804","2039393","0048992","3045616","2322441","0173886","0414078","0193164","0073099","0101095","2923316","1808482","0374463","4191054","1666801","2243469","0465997","0059550","2436386","4368814","2381111","3416744","3726704","2872462","3346224","1178665","2273657","4229236","4257858","4284010","2917506","2044056","3090634","3534602","3850214","2582496","3844362","0420293","1883180","1850397","3480796","0888817","0069409","1420554","3234126","3958494","0102002","3460252","3628334","2231253","3622592","0884732","2535470","3181822","3007302","4226388","2650978","1571404","2474024","2554274","3829170","0206636","0137355","1772382","1466054","3500822","0119310","0348124","2637294","3723996","0195753","2290553","2933474","2392672","2582426","2381941","2247732","2555736","0963207","2401097","2097298","2358925","2636124","2199571","1991031","1780798","1661199","2917388","3203616","2418558","3332064","1791682","0041968","2908446","0120471","0468445","2224026","2649554","2515034","2820852","2118624","3395184","4475970","0484855","2182001","0087650","2561572","3892434","2204315","0064146","1114698","1595366","2393845","2548208","0107930","0092216","2872750","2493486","4299972","4324274","2922440","2404425","4073952","2962876","0089538","1964418","0113638","2656588","3450650","3149640","3365778","0124770","3104930","2726560","1555440","3622332","2404299","1772288","0327698","2044801","3064298","2126355","2788716","3098812","3699674","2679042","4312536","3623726","3155242","3327624","2848292","2980472","2402927","0076727","0055400","3464902","3499048","1881002","2967224","3205376","2403021","1731701","0060330","0439876","0059855","2486678","0072613","0874952","1217565","3659388","2948790","3472226","1198196","3312830","3247714","4382552","0080037","0080439","0419058","3079380","3152624","0085204","3817848","1243974","3672840","1674771","4393514","3133722","1924273","0045708","2096673","2415458","3043546","0903657","1951266","2120120","3183660","1585255","0193524","3168230","2709768","1024215","2140379","1618442","3850590","1386697","1628841","2660888","0495034","0297814","0084921","0079043","2637276","1727770","2293640","0111190","0115714","1979388","1355683","2379713","0086148","0363828","3899796","1421378","0418141","2235542","0191423","1082588","0246641","0246645","1260502","0218388","1999192","0808508","4209802","1296373","1980162","2080374","2884018","1524930","2428170","2967008","4442130","2758904","3248600","1629242","2145829","3525346","0455135","0496325","2517558","0067952","1321869","2975590","2181959","0087746","0094673","2870648","3511542","0207374","2268016","3040964","1286785","3819668","1638355","2140423","3895884","3488710","4172430","1951299","2796678","2309260","2808986","3689498","4126340","0122227","0382868","2402101","0465316","4328798","1663202","3715320","0904049","3411432","1798684","3397884","3086442","2134170","0443465","2401878","4005402","3017864","1725986","0128221","2737926","0082562","2361509","0095312","3774694","3170832","3687398","4178092","0246643","4263482","3877674","3793788","1413314","1329665","3567288","1741273","0000516","4705522","4084744","3316948","1398426","3813310","0830361","3824458","1706598","0225009","2446980","1677720","1976009","4600952","0077973","1727776","3077214","3457734","3672742","3816372","3832914","3569230","3705412","0810819","2490326","0079679","0075468","0186408","0067789","0070439","0073442","0065670","4425064","4062536","1365050","3487994","4009460","0062083","3221698","3605418","0296310","1151911","1172049","0643109","1018765","0462335","3530002","2625810","3067274","2719848","3792960","1895587","1596345","3072482","2503944","4176776","0315152","2965466","3702996","0453671","3642618","2510894","3475596","0805559","1754656","1957938","3774466","0451279","4287320","0490215","3682448","4034452","3720058","1694021","3327994","3560464","2735292","0475290","4144504","4176826","3597400","2947832","2537390","2347134","2191400","0398563","0270288","1051904","3862750","3164256","1817771","2494362","3454574","2910904","3626804","3203606","0270560","0071647","0187598","3322364","2452042","0172184","0216755","0092745","0083100","3748440","0118983","4272866","3076658","2065968","2980626","5184298","1291570","3593046","0082726","0343663","0478566","0134614","0229922","1863347","0086333","0091942","0459944","0080263","0079902","4050552","1998643","1672218","1337072","1321969","1061123","0827573","3577624","0082153","0064265","0185534","3748512","2304933","4537842","4594834","3859076","3291148","1596363","4270878","2479478","5069564","0495241","4843046","2322517","1369845","4171032","1608290","1292566","3028018","0077429","2386404","3345472","3345474","0182015","4550098","3201722","1528854","1850457","5056034","2267968","2132405","1734589","3703908","2112277","1374989","2504640","4935372","3511596","3845232","0119571","4701546","2718440","4449576","3510480","4144190","2869728","3471098","1083452","0101893","4019560","3018070","4086032","3564794","3231054","2580382","1860213","0056405","3270538","3355694","0189160","2025690","0856797","4366830","2404233","4285496","3499096","1179933","3300542","2948356","3553442","3147312","3381008","0066963","0088263","3715122","3910804","4935334","2888046","4592572","1276121","4698684","0347840","0962762","0075703","0380249","4104054","2400291","5326448","1974419","1971571","2057392","4991652","2091935","0134854","4136084","3760922","4899406","1468846","4139124","2507238","5480340","2937696","3544112","3763866","5247022","2381991","4438848","0063465","3733774","5022702","1585985","1794821","0108317","0109000","0787524","2474932","0090334","2241351","3628584","2277860","2702724","1985949","3715854","3212232","4651410","3774114","0117876","2865120","3703750","4788944","2374144","3799694","4763168","0077278","0102083","5653294","4052882","0206334","4016934","2567026","3691740","5111874","1700841","0165348","5368354","2667380","3553976","4048272","5215952","0106591","4501454","3110958","5066574","4513674","0185481","4034354","4769836","0068972","3949660","2452386","3960412","5051278","0211281","0795176","5192124","3065204","0995868","1289401","1489889","5275892","0118745","1703957","0043147","4196776","2263814","0066806","0918940","4094724","2823054","3416828","4786282","2788732","4193394","4437216","3963816","5613056","1735907","0798722","3666024","4796122","3531824","0422370","3263904","0099595","5849950","0065794","0136535","1355631","2005151","3903852","4853102","4651520","2582782","5595168","4160708","3732950","4831420","1878870","3716530","5700672","4970632","2404435","4975722","2461150","4302938","1473832","1860357","1935859","3631112","2140479","4781612","3138698","2967286","4262980","0211729","0211730","5311514","0208558","1694505","5836262","2119532","5943936","3718778","1350929","1540011","3835080","5640450","2543164","4624424","0825283","4451458","4547056","4119278","5952332","5521550","1714917","0447987","5340362","5487524","3783958","5895028","1724597","3062096","2387499","1655461","1267299","3393786","6023444","1725969","0210044","4034228","3741834","5254868","6016776","1798603","4431208","4964772","1542768","0415481","6156350","5555502","2654430","0756316","3260022","5323662","3521164","1711525","3922818","3748528","4972582","3717252","4540710","1355644","4846340","2671706","4276820","4501244","3470600","5804038","0022002","2094766","1753383","0085937","4635282","3401882","0368264","3606888","4116284","0122264","5358714","6217368","3067038","5084196","0822818","6090102","5084198","4425200","5052448","3315342","3731562","2763304","5462602","2990126","0079285","2771200","3874544","1753786","5726616","2396589","1219827","6184894","4465564","6438918","5662106","4671002","4255304","0109965","0248752","5173032","3717490","2316204","4158096","0410650","0803093","1619856","6648926","0493405","1412528","6649108","0188503","0219251","4481414","0185906","0216434","1469304","2334871","2345759","0200809","4630562","5893332","3762912","3155328","2091256","4695012","3606752","0425253","5491994","5655222","6333064","0081846","6264596","0330829","5129510","0877057","0374887","5592248","3890160","3967856","3273632","4799050","6263642","4471456","3397160","0105321","0095875","0223954","0095730","0422618","6714534","0117880","3469046","0219233","3066856","0209074","1315584","1318414","0150742","0219263","5494396","0213309","1259772","0366177","0350934","0368574","0201520","3450958","4995790","5536736","4758646","6039532","6822400","6878486","2239822","4464394","2626338","1352408","0216126","0459945","0091093","4447518","0115195","1536537","2406566","0809951","2417712","3973198","5013056","0071203","6840134","4289434","0862766","6987652","4846232","0059049","4481514","5439796","1648190","5140878","0146970","1396484","0251333","0487132","0882997","1070753","0189195","4877122","1241317","5362988","7044010","4633690","1959563","5950978","0069369","5135434","6354108","0273646","7158814","4649466","6254796","1856101","3486626","1835980","3469518","5109784","6333060","4126568","2492564","1332537","3532216","5030402","1981128","7164714","5544384","5027774","4925292","3402236","2380307","6335734","5580036","6317962","1691448","7291268","0251654","3185602","4468740","7387408","0057936","4686844","3262342","6769208","7057376","2283362","4129180","4348012","4960934","5825380","3654796","4778988","6000478","4555426","2527336","6359956","5580390","4209788","2543472","5657846","0118460","7214762","3521126","6294822","0832879","1485796","3411444","7539884","6892388","5776858","7544820","7193448","0114395","0031405","0030604","0030608","0368575","2798920","6881890","0393596","7738550","1467306","5519340","1590193","7807952","6149818","7808620","5726086","0092046","0095835","2704998","4500922","5104604","5461956","7379330","5783956","1016024","0078090","2548396","5189670","0453047","1365519","5607028","6053438","7924798","1137450","1620680","5164432","6644200","4244998","4547194","1665071","3317234","2531344","2557478","2231461","4881806","3606756","5463162","3778644","7681902","5688932","5095030","6768578","6911608","2854926","1318517","5686062","5359048","4912910","7690670","1665744","7349662","4073790","1680019","7620650","3977428","7293380","0179011","3333182","5805470","1636780","2323836","3110014","3837248","5342766","5476944","5914996","6397426","8391976"]}');

/***/ }),

/***/ "./www/js/models/movies.js":
/*!*********************************!*\
  !*** ./www/js/models/movies.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _links_links_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./links/links.json */ "./www/js/models/links/links.json");




let moviesModel = {
    url: "http://www.omdbapi.com/",
    current: {},
    getMovies: function() {
        var randomNumber = _links_links_json__WEBPACK_IMPORTED_MODULE_1__.Movies[Math.floor(Math.random() * 8000)];

        mithril__WEBPACK_IMPORTED_MODULE_0___default().request({
            url: `${moviesModel.url}?apikey=55623944&i=tt${randomNumber}&plot=full`,
            method: "GET",
        }).then(function(result) {
            moviesModel.current = result;
        });
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (moviesModel);


/***/ }),

/***/ "./www/js/models/regi.js":
/*!*******************************!*\
  !*** ./www/js/models/regi.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);



let regi = {
    url: "https://lager.emilfolino.se/v2/auth/register",
    email: "",
    password: "",
    token: "",

    register: function() {
        mithril__WEBPACK_IMPORTED_MODULE_0___default().request({
            url: regi.url,
            method: "POST",
            body: {
                email: regi.email,
                password: regi.password,
                api_key: "785a264c48edd237e29d1ae95bf39859"
            }
        }).then(function(result) {
            regi.email = "";
            regi.password = "";
            console.log(result.data.token);

            regi.token = result.data.token;
            return mithril__WEBPACK_IMPORTED_MODULE_0___default().route.set("/");
        });
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (regi);


/***/ }),

/***/ "./www/js/view/cocktails.js":
/*!**********************************!*\
  !*** ./www/js/view/cocktails.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/cocktails.js */ "./www/js/models/cocktails.js");




let cocktails = {
    oninit: _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.getCocktail,
    view: function() {
        return [
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "What cocktail should I make?"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("form", {
                onsubmit: function () {
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.getCocktail();
                }
            },
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", "You should make a.."),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h3.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strDrink)),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("img", {
                "class": "movieImg",
                "src": _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strDrinkThumb
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("button.buttonCenter", "Next cocktail"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "Cocktail-info"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("div.infoDiv",
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strAlcoholic + " beverage"
                )),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure1, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient1),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure2, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient2),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure3, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient3),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure4, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient4),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure5, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient5),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure6, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient6),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure7, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient7),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure8, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient8),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure9, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient9),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure10, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient10),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure11, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient11),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure12, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient12),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure13, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient13),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure14, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient14),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure15, " ",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient15),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center",
                    _models_cocktails_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strInstructions
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            )
            )
        ];
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (cocktails);


/***/ }),

/***/ "./www/js/view/food.js":
/*!*****************************!*\
  !*** ./www/js/view/food.js ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_food_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/food.js */ "./www/js/models/food.js");




let foods = {
    oninit: _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.getFood,
    view: function() {
        return [
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "What food should I make?"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("form", {
                onsubmit: function () {
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.getFood();
                }
            },
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", "You should cook.."),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h3.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeal)),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("img", {
                "class": "movieImg",
                "src": _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMealThumb
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("button.buttonCenter", "Next recipe"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "Food-info"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("div.infoDiv",
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strCategory
                )),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure1, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient1),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure2, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient2),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure3, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient3),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure4, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient4),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure5, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient5),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure6, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient6),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure7, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient7),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure8, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient8),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure9, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient9),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure10, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient10),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure11, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient11),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure12, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient12),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure13, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient13),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure14, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient14),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure15, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient15),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure16, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient16),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure17, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient17),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure18, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient18),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure19, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient19),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strMeasure20, " ",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strIngredient20),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center",
                    _models_food_js__WEBPACK_IMPORTED_MODULE_1__.default.current.strInstructions
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            )
            )
        ];
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (foods);


/***/ }),

/***/ "./www/js/view/layout.js":
/*!*******************************!*\
  !*** ./www/js/view/layout.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_auth_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/auth.js */ "./www/js/models/auth.js");





let layout = {
    view: function(vnode) {
        if (_models_auth_js__WEBPACK_IMPORTED_MODULE_1__.default.token.length > 20) {
            return mithril__WEBPACK_IMPORTED_MODULE_0___default()("main", [
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("navbar.navbar", [
                    mithril__WEBPACK_IMPORTED_MODULE_0___default()("div.container", [
                        mithril__WEBPACK_IMPORTED_MODULE_0___default()("ul.nav", [
                            mithril__WEBPACK_IMPORTED_MODULE_0___default()("li", [
                                mithril__WEBPACK_IMPORTED_MODULE_0___default()("a", {
                                    href: "#!/movies" }, "Movies")
                            ]),
                            mithril__WEBPACK_IMPORTED_MODULE_0___default()("li", [
                                mithril__WEBPACK_IMPORTED_MODULE_0___default()("a", {
                                    href: "#!/cocktails" }, "Cocktails")
                            ]),
                            mithril__WEBPACK_IMPORTED_MODULE_0___default()("li", [
                                mithril__WEBPACK_IMPORTED_MODULE_0___default()("a", {
                                    href: "#!/foods" }, "Foods")
                            ])

                        ])
                    ])
                ]),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("section.container", vnode.children)
            ]);
        } else {
            return mithril__WEBPACK_IMPORTED_MODULE_0___default()("main", [
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("navbar.navbar", [
                    mithril__WEBPACK_IMPORTED_MODULE_0___default()("div.container", [
                        mithril__WEBPACK_IMPORTED_MODULE_0___default()("ul.nav", [
                            mithril__WEBPACK_IMPORTED_MODULE_0___default()("li", [
                                mithril__WEBPACK_IMPORTED_MODULE_0___default()("a", {
                                    href: "#!/login" }, "Login")
                            ])
                        ])
                    ])
                ]),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("section.container", vnode.children)
            ]);
        }
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (layout);


/***/ }),

/***/ "./www/js/view/login.js":
/*!******************************!*\
  !*** ./www/js/view/login.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/auth */ "./www/js/models/auth.js");




let login = {
    view: function() {
        return [
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "Welcome to Eddies project!!"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", "Login to continue."),

            mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center",
                [
                    "No account? ",
                    mithril__WEBPACK_IMPORTED_MODULE_0___default()("a", {href: "#!/register"},
                        "Register here!"
                    )
                ]
            ),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("form", {
                onsubmit: function () {
                    _models_auth__WEBPACK_IMPORTED_MODULE_1__.default.login();
                }
            },
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("label.input-label", "E-mail"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=email].input", {
                oninput: function (event) {
                    _models_auth__WEBPACK_IMPORTED_MODULE_1__.default.email = event.target.value;
                },
                value: _models_auth__WEBPACK_IMPORTED_MODULE_1__.default.email
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("label.input-label", "Password"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=password].input", {
                oninput: function (event) {
                    _models_auth__WEBPACK_IMPORTED_MODULE_1__.default.password = event.target.value;
                },
                value: _models_auth__WEBPACK_IMPORTED_MODULE_1__.default.password
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=submit][value=Log in].buttonCenter", "Log in")
            )
        ];
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (login);


/***/ }),

/***/ "./www/js/view/movies.js":
/*!*******************************!*\
  !*** ./www/js/view/movies.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_movies_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/movies.js */ "./www/js/models/movies.js");




let movies = {
    oninit: _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.getMovies,
    view: function() {
        return [
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "What movie should I watch?"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("form", {
                onsubmit: function () {
                    _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.getMovies();
                }
            },
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", "You should watch.."),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h3.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b", _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Title)),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("img", {
                "class": "movieImg",
                "src": _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Poster
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("button.buttonCenter", "Next movie"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1.center", "Movie-info"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("div.infoDiv",
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b",
                    _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Year
                )),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center",
                    _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Language
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b", "Actors"), mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                    _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Actors
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center",
                    _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.Plot
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("p.center", mithril__WEBPACK_IMPORTED_MODULE_0___default()("b",
                    "IMDB RATING " + _models_movies_js__WEBPACK_IMPORTED_MODULE_1__.default.current.imdbRating
                )
                ),
                mithril__WEBPACK_IMPORTED_MODULE_0___default()("br"),
            )
            )
        ];
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (movies);


/***/ }),

/***/ "./www/js/view/register.js":
/*!*********************************!*\
  !*** ./www/js/view/register.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _models_regi__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../models/regi */ "./www/js/models/regi.js");




let register = {
    view: function() {
        return [
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("h1", "Register account"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("form", {
                onsubmit: function () {
                    _models_regi__WEBPACK_IMPORTED_MODULE_1__.default.register();
                }
            },
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("label.input-label", "E-mail"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=email].input", {
                oninput: function (event) {
                    _models_regi__WEBPACK_IMPORTED_MODULE_1__.default.email = event.target.value;
                },
                value: _models_regi__WEBPACK_IMPORTED_MODULE_1__.default.email
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("label.input-label", "Password"),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=password].input", {
                oninput: function (event) {
                    _models_regi__WEBPACK_IMPORTED_MODULE_1__.default.password = event.target.value;
                },
                value: _models_regi__WEBPACK_IMPORTED_MODULE_1__.default.password
            }),
            mithril__WEBPACK_IMPORTED_MODULE_0___default()("input[type=submit][value=Registrera].button", "Registrera")
            )
        ];
    }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (register);


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*************************!*\
  !*** ./www/js/index.js ***!
  \*************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! mithril */ "./node_modules/mithril/index.js");
/* harmony import */ var mithril__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(mithril__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _view_movies__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./view/movies */ "./www/js/view/movies.js");
/* harmony import */ var _models_auth_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./models/auth.js */ "./www/js/models/auth.js");
/* harmony import */ var _view_login_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./view/login.js */ "./www/js/view/login.js");
/* harmony import */ var _view_cocktails_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./view/cocktails.js */ "./www/js/view/cocktails.js");
/* harmony import */ var _view_food_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./view/food.js */ "./www/js/view/food.js");
/* harmony import */ var _view_layout_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./view/layout.js */ "./www/js/view/layout.js");
/* harmony import */ var _view_register_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./view/register.js */ "./www/js/view/register.js");











// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    mithril__WEBPACK_IMPORTED_MODULE_0___default().route(document.body, "/", {
        "/": {
            render: function() {
                return mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_layout_js__WEBPACK_IMPORTED_MODULE_6__.default, mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_login_js__WEBPACK_IMPORTED_MODULE_3__.default));
            }
        },
        "/register": {
            render: function() {
                return mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_layout_js__WEBPACK_IMPORTED_MODULE_6__.default, mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_register_js__WEBPACK_IMPORTED_MODULE_7__.default));
            }
        },
        "/movies": {
            onmatch: function() {
                if (_models_auth_js__WEBPACK_IMPORTED_MODULE_2__.default.token) {
                    return _view_movies__WEBPACK_IMPORTED_MODULE_1__.default;
                }

                return mithril__WEBPACK_IMPORTED_MODULE_0___default().route.set("/login");
            },
            render: function(vnode) {
                return mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_layout_js__WEBPACK_IMPORTED_MODULE_6__.default, vnode);
            }
        },
        "/cocktails": {
            onmatch: function() {
                if (_models_auth_js__WEBPACK_IMPORTED_MODULE_2__.default.token) {
                    return _view_cocktails_js__WEBPACK_IMPORTED_MODULE_4__.default;
                }

                return mithril__WEBPACK_IMPORTED_MODULE_0___default().route.set("/login");
            },
            render: function(vnode) {
                return mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_layout_js__WEBPACK_IMPORTED_MODULE_6__.default, vnode);
            }
        },
        "/foods": {
            onmatch: function() {
                if (_models_auth_js__WEBPACK_IMPORTED_MODULE_2__.default.token) {
                    return _view_food_js__WEBPACK_IMPORTED_MODULE_5__.default;
                }

                return mithril__WEBPACK_IMPORTED_MODULE_0___default().route.set("/login");
            },
            render: function(vnode) {
                return mithril__WEBPACK_IMPORTED_MODULE_0___default()(_view_layout_js__WEBPACK_IMPORTED_MODULE_6__.default, vnode);
            }
        },
    });
}

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL2FwaS9tb3VudC1yZWRyYXcuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9hcGkvcm91dGVyLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvaHlwZXJzY3JpcHQuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9pbmRleC5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL21vdW50LXJlZHJhdy5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3BhdGhuYW1lL2Fzc2lnbi5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3BhdGhuYW1lL2J1aWxkLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvcGF0aG5hbWUvY29tcGlsZVRlbXBsYXRlLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvcGF0aG5hbWUvcGFyc2UuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9wcm9taXNlL3BvbHlmaWxsLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvcHJvbWlzZS9wcm9taXNlLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvcXVlcnlzdHJpbmcvYnVpbGQuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9xdWVyeXN0cmluZy9wYXJzZS5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci9mcmFnbWVudC5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci9oeXBlcnNjcmlwdC5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci9oeXBlcnNjcmlwdFZub2RlLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vbm9kZV9tb2R1bGVzL21pdGhyaWwvcmVuZGVyL3JlbmRlci5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci90cnVzdC5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlbmRlci92bm9kZS5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL25vZGVfbW9kdWxlcy9taXRocmlsL3JlcXVlc3QuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9yZXF1ZXN0L3JlcXVlc3QuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi9ub2RlX21vZHVsZXMvbWl0aHJpbC9yb3V0ZS5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL3d3dy9qcy9tb2RlbHMvYXV0aC5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC8uL3d3dy9qcy9tb2RlbHMvY29ja3RhaWxzLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vd3d3L2pzL21vZGVscy9mb29kLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vd3d3L2pzL21vZGVscy9tb3ZpZXMuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvbW9kZWxzL3JlZ2kuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvdmlldy9jb2NrdGFpbHMuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvdmlldy9mb29kLmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vd3d3L2pzL3ZpZXcvbGF5b3V0LmpzIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0Ly4vd3d3L2pzL3ZpZXcvbG9naW4uanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvdmlldy9tb3ZpZXMuanMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvdmlldy9yZWdpc3Rlci5qcyIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC93ZWJwYWNrL3J1bnRpbWUvY29tcGF0IGdldCBkZWZhdWx0IGV4cG9ydCIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3Qvd2VicGFjay9ydW50aW1lL2dsb2JhbCIsIndlYnBhY2s6Ly9kYndlYmIucHJvamVrdC93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2Rid2ViYi5wcm9qZWt0L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vZGJ3ZWJiLnByb2pla3QvLi93d3cvanMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFZOztBQUVaLFlBQVksbUJBQU8sQ0FBQywrREFBaUI7O0FBRXJDO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQiwwQkFBMEI7QUFDM0MsUUFBUTtBQUNSLGNB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QUFFLDhDQUFDLENBQUMsc0RBQVE7QUFDM0M7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBLG9CQUFvQiwwREFBVTtBQUM5QiwyQkFBMkIsaURBQU07QUFDakM7O0FBRUEsdUJBQXVCLHdEQUFXO0FBQ2xDLGFBQWE7QUFDYjtBQUNBLHVCQUF1Qiw4Q0FBQyxDQUFDLG9EQUFNO0FBQy9CO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQSxvQkFBb0IsMERBQVU7QUFDOUIsMkJBQTJCLHVEQUFTO0FBQ3BDOztBQUVBLHVCQUF1Qix3REFBVztBQUNsQyxhQUFhO0FBQ2I7QUFDQSx1QkFBdUIsOENBQUMsQ0FBQyxvREFBTTtBQUMvQjtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0Esb0JBQW9CLDBEQUFVO0FBQzlCLDJCQUEyQixrREFBSztBQUNoQzs7QUFFQSx1QkFBdUIsd0RBQVc7QUFDbEMsYUFBYTtBQUNiO0FBQ0EsdUJBQXVCLDhDQUFDLENBQUMsb0RBQU07QUFDL0I7QUFDQSxTQUFTO0FBQ1QsS0FBSztBQUNMIiwiZmlsZSI6ImJ1bmRsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihyZW5kZXIsIHNjaGVkdWxlLCBjb25zb2xlKSB7XG5cdHZhciBzdWJzY3JpcHRpb25zID0gW11cblx0dmFyIHJlbmRlcmluZyA9IGZhbHNlXG5cdHZhciBwZW5kaW5nID0gZmFsc2VcblxuXHRmdW5jdGlvbiBzeW5jKCkge1xuXHRcdGlmIChyZW5kZXJpbmcpIHRocm93IG5ldyBFcnJvcihcIk5lc3RlZCBtLnJlZHJhdy5zeW5jKCkgY2FsbFwiKVxuXHRcdHJlbmRlcmluZyA9IHRydWVcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmlwdGlvbnMubGVuZ3RoOyBpICs9IDIpIHtcblx0XHRcdHRyeSB7IHJlbmRlcihzdWJzY3JpcHRpb25zW2ldLCBWbm9kZShzdWJzY3JpcHRpb25zW2kgKyAxXSksIHJlZHJhdykgfVxuXHRcdFx0Y2F0Y2ggKGUpIHsgY29uc29sZS5lcnJvcihlKSB9XG5cdFx0fVxuXHRcdHJlbmRlcmluZyA9IGZhbHNlXG5cdH1cblxuXHRmdW5jdGlvbiByZWRyYXcoKSB7XG5cdFx0aWYgKCFwZW5kaW5nKSB7XG5cdFx0XHRwZW5kaW5nID0gdHJ1ZVxuXHRcdFx0c2NoZWR1bGUoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHBlbmRpbmcgPSBmYWxzZVxuXHRcdFx0XHRzeW5jKClcblx0XHRcdH0pXG5cdFx0fVxuXHR9XG5cblx0cmVkcmF3LnN5bmMgPSBzeW5jXG5cblx0ZnVuY3Rpb24gbW91bnQocm9vdCwgY29tcG9uZW50KSB7XG5cdFx0aWYgKGNvbXBvbmVudCAhPSBudWxsICYmIGNvbXBvbmVudC52aWV3ID09IG51bGwgJiYgdHlwZW9mIGNvbXBvbmVudCAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKFwibS5tb3VudChlbGVtZW50LCBjb21wb25lbnQpIGV4cGVjdHMgYSBjb21wb25lbnQsIG5vdCBhIHZub2RlXCIpXG5cdFx0fVxuXG5cdFx0dmFyIGluZGV4ID0gc3Vic2NyaXB0aW9ucy5pbmRleE9mKHJvb3QpXG5cdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdHN1YnNjcmlwdGlvbnMuc3BsaWNlKGluZGV4LCAyKVxuXHRcdFx0cmVuZGVyKHJvb3QsIFtdLCByZWRyYXcpXG5cdFx0fVxuXG5cdFx0aWYgKGNvbXBvbmVudCAhPSBudWxsKSB7XG5cdFx0XHRzdWJzY3JpcHRpb25zLnB1c2gocm9vdCwgY29tcG9uZW50KVxuXHRcdFx0cmVuZGVyKHJvb3QsIFZub2RlKGNvbXBvbmVudCksIHJlZHJhdylcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge21vdW50OiBtb3VudCwgcmVkcmF3OiByZWRyYXd9XG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgVm5vZGUgPSByZXF1aXJlKFwiLi4vcmVuZGVyL3Zub2RlXCIpXG52YXIgbSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvaHlwZXJzY3JpcHRcIilcbnZhciBQcm9taXNlID0gcmVxdWlyZShcIi4uL3Byb21pc2UvcHJvbWlzZVwiKVxuXG52YXIgYnVpbGRQYXRobmFtZSA9IHJlcXVpcmUoXCIuLi9wYXRobmFtZS9idWlsZFwiKVxudmFyIHBhcnNlUGF0aG5hbWUgPSByZXF1aXJlKFwiLi4vcGF0aG5hbWUvcGFyc2VcIilcbnZhciBjb21waWxlVGVtcGxhdGUgPSByZXF1aXJlKFwiLi4vcGF0aG5hbWUvY29tcGlsZVRlbXBsYXRlXCIpXG52YXIgYXNzaWduID0gcmVxdWlyZShcIi4uL3BhdGhuYW1lL2Fzc2lnblwiKVxuXG52YXIgc2VudGluZWwgPSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCR3aW5kb3csIG1vdW50UmVkcmF3KSB7XG5cdHZhciBmaXJlQXN5bmNcblxuXHRmdW5jdGlvbiBzZXRQYXRoKHBhdGgsIGRhdGEsIG9wdGlvbnMpIHtcblx0XHRwYXRoID0gYnVpbGRQYXRobmFtZShwYXRoLCBkYXRhKVxuXHRcdGlmIChmaXJlQXN5bmMgIT0gbnVsbCkge1xuXHRcdFx0ZmlyZUFzeW5jKClcblx0XHRcdHZhciBzdGF0ZSA9IG9wdGlvbnMgPyBvcHRpb25zLnN0YXRlIDogbnVsbFxuXHRcdFx0dmFyIHRpdGxlID0gb3B0aW9ucyA/IG9wdGlvbnMudGl0bGUgOiBudWxsXG5cdFx0XHRpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlcGxhY2UpICR3aW5kb3cuaGlzdG9yeS5yZXBsYWNlU3RhdGUoc3RhdGUsIHRpdGxlLCByb3V0ZS5wcmVmaXggKyBwYXRoKVxuXHRcdFx0ZWxzZSAkd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKHN0YXRlLCB0aXRsZSwgcm91dGUucHJlZml4ICsgcGF0aClcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHQkd2luZG93LmxvY2F0aW9uLmhyZWYgPSByb3V0ZS5wcmVmaXggKyBwYXRoXG5cdFx0fVxuXHR9XG5cblx0dmFyIGN1cnJlbnRSZXNvbHZlciA9IHNlbnRpbmVsLCBjb21wb25lbnQsIGF0dHJzLCBjdXJyZW50UGF0aCwgbGFzdFVwZGF0ZVxuXG5cdHZhciBTS0lQID0gcm91dGUuU0tJUCA9IHt9XG5cblx0ZnVuY3Rpb24gcm91dGUocm9vdCwgZGVmYXVsdFJvdXRlLCByb3V0ZXMpIHtcblx0XHRpZiAocm9vdCA9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoXCJFbnN1cmUgdGhlIERPTSBlbGVtZW50IHRoYXQgd2FzIHBhc3NlZCB0byBgbS5yb3V0ZWAgaXMgbm90IHVuZGVmaW5lZFwiKVxuXHRcdC8vIDAgPSBzdGFydFxuXHRcdC8vIDEgPSBpbml0XG5cdFx0Ly8gMiA9IHJlYWR5XG5cdFx0dmFyIHN0YXRlID0gMFxuXG5cdFx0dmFyIGNvbXBpbGVkID0gT2JqZWN0LmtleXMocm91dGVzKS5tYXAoZnVuY3Rpb24ocm91dGUpIHtcblx0XHRcdGlmIChyb3V0ZVswXSAhPT0gXCIvXCIpIHRocm93IG5ldyBTeW50YXhFcnJvcihcIlJvdXRlcyBtdXN0IHN0YXJ0IHdpdGggYSBgL2BcIilcblx0XHRcdGlmICgoLzooW15cXC9cXC4tXSspKFxcLnszfSk/Oi8pLnRlc3Qocm91dGUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBTeW50YXhFcnJvcihcIlJvdXRlIHBhcmFtZXRlciBuYW1lcyBtdXN0IGJlIHNlcGFyYXRlZCB3aXRoIGVpdGhlciBgL2AsIGAuYCwgb3IgYC1gXCIpXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyb3V0ZTogcm91dGUsXG5cdFx0XHRcdGNvbXBvbmVudDogcm91dGVzW3JvdXRlXSxcblx0XHRcdFx0Y2hlY2s6IGNvbXBpbGVUZW1wbGF0ZShyb3V0ZSksXG5cdFx0XHR9XG5cdFx0fSlcblx0XHR2YXIgY2FsbEFzeW5jID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gc2V0SW1tZWRpYXRlIDogc2V0VGltZW91dFxuXHRcdHZhciBwID0gUHJvbWlzZS5yZXNvbHZlKClcblx0XHR2YXIgc2NoZWR1bGVkID0gZmFsc2Vcblx0XHR2YXIgb25yZW1vdmVcblxuXHRcdGZpcmVBc3luYyA9IG51bGxcblxuXHRcdGlmIChkZWZhdWx0Um91dGUgIT0gbnVsbCkge1xuXHRcdFx0dmFyIGRlZmF1bHREYXRhID0gcGFyc2VQYXRobmFtZShkZWZhdWx0Um91dGUpXG5cblx0XHRcdGlmICghY29tcGlsZWQuc29tZShmdW5jdGlvbiAoaSkgeyByZXR1cm4gaS5jaGVjayhkZWZhdWx0RGF0YSkgfSkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFJlZmVyZW5jZUVycm9yKFwiRGVmYXVsdCByb3V0ZSBkb2Vzbid0IG1hdGNoIGFueSBrbm93biByb3V0ZXNcIilcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmdW5jdGlvbiByZXNvbHZlUm91dGUoKSB7XG5cdFx0XHRzY2hlZHVsZWQgPSBmYWxzZVxuXHRcdFx0Ly8gQ29uc2lkZXIgdGhlIHBhdGhuYW1lIGhvbGlzdGljYWxseS4gVGhlIHByZWZpeCBtaWdodCBldmVuIGJlIGludmFsaWQsXG5cdFx0XHQvLyBidXQgdGhhdCdzIG5vdCBvdXIgcHJvYmxlbS5cblx0XHRcdHZhciBwcmVmaXggPSAkd2luZG93LmxvY2F0aW9uLmhhc2hcblx0XHRcdGlmIChyb3V0ZS5wcmVmaXhbMF0gIT09IFwiI1wiKSB7XG5cdFx0XHRcdHByZWZpeCA9ICR3aW5kb3cubG9jYXRpb24uc2VhcmNoICsgcHJlZml4XG5cdFx0XHRcdGlmIChyb3V0ZS5wcmVmaXhbMF0gIT09IFwiP1wiKSB7XG5cdFx0XHRcdFx0cHJlZml4ID0gJHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSArIHByZWZpeFxuXHRcdFx0XHRcdGlmIChwcmVmaXhbMF0gIT09IFwiL1wiKSBwcmVmaXggPSBcIi9cIiArIHByZWZpeFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBUaGlzIHNlZW1pbmdseSB1c2VsZXNzIGAuY29uY2F0KClgIHNwZWVkcyB1cCB0aGUgdGVzdHMgcXVpdGUgYSBiaXQsXG5cdFx0XHQvLyBzaW5jZSB0aGUgcmVwcmVzZW50YXRpb24gaXMgY29uc2lzdGVudGx5IGEgcmVsYXRpdmVseSBwb29ybHlcblx0XHRcdC8vIG9wdGltaXplZCBjb25zIHN0cmluZy5cblx0XHRcdHZhciBwYXRoID0gcHJlZml4LmNvbmNhdCgpXG5cdFx0XHRcdC5yZXBsYWNlKC8oPzolW2EtZjg5XVthLWYwLTldKSsvZ2ltLCBkZWNvZGVVUklDb21wb25lbnQpXG5cdFx0XHRcdC5zbGljZShyb3V0ZS5wcmVmaXgubGVuZ3RoKVxuXHRcdFx0dmFyIGRhdGEgPSBwYXJzZVBhdGhuYW1lKHBhdGgpXG5cblx0XHRcdGFzc2lnbihkYXRhLnBhcmFtcywgJHdpbmRvdy5oaXN0b3J5LnN0YXRlKVxuXG5cdFx0XHRmdW5jdGlvbiBmYWlsKCkge1xuXHRcdFx0XHRpZiAocGF0aCA9PT0gZGVmYXVsdFJvdXRlKSB0aHJvdyBuZXcgRXJyb3IoXCJDb3VsZCBub3QgcmVzb2x2ZSBkZWZhdWx0IHJvdXRlIFwiICsgZGVmYXVsdFJvdXRlKVxuXHRcdFx0XHRzZXRQYXRoKGRlZmF1bHRSb3V0ZSwgbnVsbCwge3JlcGxhY2U6IHRydWV9KVxuXHRcdFx0fVxuXG5cdFx0XHRsb29wKDApXG5cdFx0XHRmdW5jdGlvbiBsb29wKGkpIHtcblx0XHRcdFx0Ly8gMCA9IGluaXRcblx0XHRcdFx0Ly8gMSA9IHNjaGVkdWxlZFxuXHRcdFx0XHQvLyAyID0gZG9uZVxuXHRcdFx0XHRmb3IgKDsgaSA8IGNvbXBpbGVkLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0aWYgKGNvbXBpbGVkW2ldLmNoZWNrKGRhdGEpKSB7XG5cdFx0XHRcdFx0XHR2YXIgcGF5bG9hZCA9IGNvbXBpbGVkW2ldLmNvbXBvbmVudFxuXHRcdFx0XHRcdFx0dmFyIG1hdGNoZWRSb3V0ZSA9IGNvbXBpbGVkW2ldLnJvdXRlXG5cdFx0XHRcdFx0XHR2YXIgbG9jYWxDb21wID0gcGF5bG9hZFxuXHRcdFx0XHRcdFx0dmFyIHVwZGF0ZSA9IGxhc3RVcGRhdGUgPSBmdW5jdGlvbihjb21wKSB7XG5cdFx0XHRcdFx0XHRcdGlmICh1cGRhdGUgIT09IGxhc3RVcGRhdGUpIHJldHVyblxuXHRcdFx0XHRcdFx0XHRpZiAoY29tcCA9PT0gU0tJUCkgcmV0dXJuIGxvb3AoaSArIDEpXG5cdFx0XHRcdFx0XHRcdGNvbXBvbmVudCA9IGNvbXAgIT0gbnVsbCAmJiAodHlwZW9mIGNvbXAudmlldyA9PT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiBjb21wID09PSBcImZ1bmN0aW9uXCIpPyBjb21wIDogXCJkaXZcIlxuXHRcdFx0XHRcdFx0XHRhdHRycyA9IGRhdGEucGFyYW1zLCBjdXJyZW50UGF0aCA9IHBhdGgsIGxhc3RVcGRhdGUgPSBudWxsXG5cdFx0XHRcdFx0XHRcdGN1cnJlbnRSZXNvbHZlciA9IHBheWxvYWQucmVuZGVyID8gcGF5bG9hZCA6IG51bGxcblx0XHRcdFx0XHRcdFx0aWYgKHN0YXRlID09PSAyKSBtb3VudFJlZHJhdy5yZWRyYXcoKVxuXHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRzdGF0ZSA9IDJcblx0XHRcdFx0XHRcdFx0XHRtb3VudFJlZHJhdy5yZWRyYXcuc3luYygpXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vIFRoZXJlJ3Mgbm8gdW5kZXJzdGF0aW5nIGhvdyBtdWNoIEkgKndpc2gqIEkgY291bGRcblx0XHRcdFx0XHRcdC8vIHVzZSBgYXN5bmNgL2Bhd2FpdGAgaGVyZS4uLlxuXHRcdFx0XHRcdFx0aWYgKHBheWxvYWQudmlldyB8fCB0eXBlb2YgcGF5bG9hZCA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRcdHBheWxvYWQgPSB7fVxuXHRcdFx0XHRcdFx0XHR1cGRhdGUobG9jYWxDb21wKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZiAocGF5bG9hZC5vbm1hdGNoKSB7XG5cdFx0XHRcdFx0XHRcdHAudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHBheWxvYWQub25tYXRjaChkYXRhLnBhcmFtcywgcGF0aCwgbWF0Y2hlZFJvdXRlKVxuXHRcdFx0XHRcdFx0XHR9KS50aGVuKHVwZGF0ZSwgZmFpbClcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgdXBkYXRlKFwiZGl2XCIpXG5cdFx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0ZmFpbCgpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGl0IHVuY29uZGl0aW9uYWxseSBzbyBgbS5yb3V0ZS5zZXRgIGFuZCBgbS5yb3V0ZS5MaW5rYCBib3RoIHdvcmssXG5cdFx0Ly8gZXZlbiBpZiBuZWl0aGVyIGBwdXNoU3RhdGVgIG5vciBgaGFzaGNoYW5nZWAgYXJlIHN1cHBvcnRlZC4gSXQnc1xuXHRcdC8vIGNsZWFyZWQgaWYgYGhhc2hjaGFuZ2VgIGlzIHVzZWQsIHNpbmNlIHRoYXQgbWFrZXMgaXQgYXV0b21hdGljYWxseVxuXHRcdC8vIGFzeW5jLlxuXHRcdGZpcmVBc3luYyA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCFzY2hlZHVsZWQpIHtcblx0XHRcdFx0c2NoZWR1bGVkID0gdHJ1ZVxuXHRcdFx0XHRjYWxsQXN5bmMocmVzb2x2ZVJvdXRlKVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgJHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRvbnJlbW92ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBmaXJlQXN5bmMsIGZhbHNlKVxuXHRcdFx0fVxuXHRcdFx0JHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwicG9wc3RhdGVcIiwgZmlyZUFzeW5jLCBmYWxzZSlcblx0XHR9IGVsc2UgaWYgKHJvdXRlLnByZWZpeFswXSA9PT0gXCIjXCIpIHtcblx0XHRcdGZpcmVBc3luYyA9IG51bGxcblx0XHRcdG9ucmVtb3ZlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdCR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImhhc2hjaGFuZ2VcIiwgcmVzb2x2ZVJvdXRlLCBmYWxzZSlcblx0XHRcdH1cblx0XHRcdCR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImhhc2hjaGFuZ2VcIiwgcmVzb2x2ZVJvdXRlLCBmYWxzZSlcblx0XHR9XG5cblx0XHRyZXR1cm4gbW91bnRSZWRyYXcubW91bnQocm9vdCwge1xuXHRcdFx0b25iZWZvcmV1cGRhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRzdGF0ZSA9IHN0YXRlID8gMiA6IDFcblx0XHRcdFx0cmV0dXJuICEoIXN0YXRlIHx8IHNlbnRpbmVsID09PSBjdXJyZW50UmVzb2x2ZXIpXG5cdFx0XHR9LFxuXHRcdFx0b25jcmVhdGU6IHJlc29sdmVSb3V0ZSxcblx0XHRcdG9ucmVtb3ZlOiBvbnJlbW92ZSxcblx0XHRcdHZpZXc6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAoIXN0YXRlIHx8IHNlbnRpbmVsID09PSBjdXJyZW50UmVzb2x2ZXIpIHJldHVyblxuXHRcdFx0XHQvLyBXcmFwIGluIGEgZnJhZ21lbnQgdG8gcHJlc2VydmUgZXhpc3Rpbmcga2V5IHNlbWFudGljc1xuXHRcdFx0XHR2YXIgdm5vZGUgPSBbVm5vZGUoY29tcG9uZW50LCBhdHRycy5rZXksIGF0dHJzKV1cblx0XHRcdFx0aWYgKGN1cnJlbnRSZXNvbHZlcikgdm5vZGUgPSBjdXJyZW50UmVzb2x2ZXIucmVuZGVyKHZub2RlWzBdKVxuXHRcdFx0XHRyZXR1cm4gdm5vZGVcblx0XHRcdH0sXG5cdFx0fSlcblx0fVxuXHRyb3V0ZS5zZXQgPSBmdW5jdGlvbihwYXRoLCBkYXRhLCBvcHRpb25zKSB7XG5cdFx0aWYgKGxhc3RVcGRhdGUgIT0gbnVsbCkge1xuXHRcdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHRcdG9wdGlvbnMucmVwbGFjZSA9IHRydWVcblx0XHR9XG5cdFx0bGFzdFVwZGF0ZSA9IG51bGxcblx0XHRzZXRQYXRoKHBhdGgsIGRhdGEsIG9wdGlvbnMpXG5cdH1cblx0cm91dGUuZ2V0ID0gZnVuY3Rpb24oKSB7cmV0dXJuIGN1cnJlbnRQYXRofVxuXHRyb3V0ZS5wcmVmaXggPSBcIiMhXCJcblx0cm91dGUuTGluayA9IHtcblx0XHR2aWV3OiBmdW5jdGlvbih2bm9kZSkge1xuXHRcdFx0dmFyIG9wdGlvbnMgPSB2bm9kZS5hdHRycy5vcHRpb25zXG5cdFx0XHQvLyBSZW1vdmUgdGhlc2Ugc28gdGhleSBkb24ndCBnZXQgb3ZlcndyaXR0ZW5cblx0XHRcdHZhciBhdHRycyA9IHt9LCBvbmNsaWNrLCBocmVmXG5cdFx0XHRhc3NpZ24oYXR0cnMsIHZub2RlLmF0dHJzKVxuXHRcdFx0Ly8gVGhlIGZpcnN0IHR3byBhcmUgaW50ZXJuYWwsIGJ1dCB0aGUgcmVzdCBhcmUgbWFnaWMgYXR0cmlidXRlc1xuXHRcdFx0Ly8gdGhhdCBuZWVkIGNlbnNvcmVkIHRvIG5vdCBzY3JldyB1cCByZW5kZXJpbmcuXG5cdFx0XHRhdHRycy5zZWxlY3RvciA9IGF0dHJzLm9wdGlvbnMgPSBhdHRycy5rZXkgPSBhdHRycy5vbmluaXQgPVxuXHRcdFx0YXR0cnMub25jcmVhdGUgPSBhdHRycy5vbmJlZm9yZXVwZGF0ZSA9IGF0dHJzLm9udXBkYXRlID1cblx0XHRcdGF0dHJzLm9uYmVmb3JlcmVtb3ZlID0gYXR0cnMub25yZW1vdmUgPSBudWxsXG5cblx0XHRcdC8vIERvIHRoaXMgbm93IHNvIHdlIGNhbiBnZXQgdGhlIG1vc3QgY3VycmVudCBgaHJlZmAgYW5kIGBkaXNhYmxlZGAuXG5cdFx0XHQvLyBUaG9zZSBhdHRyaWJ1dGVzIG1heSBhbHNvIGJlIHNwZWNpZmllZCBpbiB0aGUgc2VsZWN0b3IsIGFuZCB3ZVxuXHRcdFx0Ly8gc2hvdWxkIGhvbm9yIHRoYXQuXG5cdFx0XHR2YXIgY2hpbGQgPSBtKHZub2RlLmF0dHJzLnNlbGVjdG9yIHx8IFwiYVwiLCBhdHRycywgdm5vZGUuY2hpbGRyZW4pXG5cblx0XHRcdC8vIExldCdzIHByb3ZpZGUgYSAqcmlnaHQqIHdheSB0byBkaXNhYmxlIGEgcm91dGUgbGluaywgcmF0aGVyIHRoYW5cblx0XHRcdC8vIGxldHRpbmcgcGVvcGxlIHNjcmV3IHVwIGFjY2Vzc2liaWxpdHkgb24gYWNjaWRlbnQuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gVGhlIGF0dHJpYnV0ZSBpcyBjb2VyY2VkIHNvIHVzZXJzIGRvbid0IGdldCBzdXJwcmlzZWQgb3ZlclxuXHRcdFx0Ly8gYGRpc2FibGVkOiAwYCByZXN1bHRpbmcgaW4gYSBidXR0b24gdGhhdCdzIHNvbWVob3cgcm91dGFibGVcblx0XHRcdC8vIGRlc3BpdGUgYmVpbmcgdmlzaWJseSBkaXNhYmxlZC5cblx0XHRcdGlmIChjaGlsZC5hdHRycy5kaXNhYmxlZCA9IEJvb2xlYW4oY2hpbGQuYXR0cnMuZGlzYWJsZWQpKSB7XG5cdFx0XHRcdGNoaWxkLmF0dHJzLmhyZWYgPSBudWxsXG5cdFx0XHRcdGNoaWxkLmF0dHJzW1wiYXJpYS1kaXNhYmxlZFwiXSA9IFwidHJ1ZVwiXG5cdFx0XHRcdC8vIElmIHlvdSAqcmVhbGx5KiBkbyB3YW50IHRvIGRvIHRoaXMgb24gYSBkaXNhYmxlZCBsaW5rLCB1c2Vcblx0XHRcdFx0Ly8gYW4gYG9uY3JlYXRlYCBob29rIHRvIGFkZCBpdC5cblx0XHRcdFx0Y2hpbGQuYXR0cnMub25jbGljayA9IG51bGxcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9uY2xpY2sgPSBjaGlsZC5hdHRycy5vbmNsaWNrXG5cdFx0XHRcdGhyZWYgPSBjaGlsZC5hdHRycy5ocmVmXG5cdFx0XHRcdGNoaWxkLmF0dHJzLmhyZWYgPSByb3V0ZS5wcmVmaXggKyBocmVmXG5cdFx0XHRcdGNoaWxkLmF0dHJzLm9uY2xpY2sgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0dmFyIHJlc3VsdFxuXHRcdFx0XHRcdGlmICh0eXBlb2Ygb25jbGljayA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQgPSBvbmNsaWNrLmNhbGwoZS5jdXJyZW50VGFyZ2V0LCBlKVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAob25jbGljayA9PSBudWxsIHx8IHR5cGVvZiBvbmNsaWNrICE9PSBcIm9iamVjdFwiKSB7XG5cdFx0XHRcdFx0XHQvLyBkbyBub3RoaW5nXG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2Ygb25jbGljay5oYW5kbGVFdmVudCA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRvbmNsaWNrLmhhbmRsZUV2ZW50KGUpXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gQWRhcHRlZCBmcm9tIFJlYWN0IFJvdXRlcidzIGltcGxlbWVudGF0aW9uOlxuXHRcdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9SZWFjdFRyYWluaW5nL3JlYWN0LXJvdXRlci9ibG9iLzUyMGEwYWNkNDhhZTFiMDY2ZWIwYjA3ZDZkNGQxNzkwYTFkMDI0ODIvcGFja2FnZXMvcmVhY3Qtcm91dGVyLWRvbS9tb2R1bGVzL0xpbmsuanNcblx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdC8vIFRyeSB0byBiZSBmbGV4aWJsZSBhbmQgaW50dWl0aXZlIGluIGhvdyB3ZSBoYW5kbGUgbGlua3MuXG5cdFx0XHRcdFx0Ly8gRnVuIGZhY3Q6IGxpbmtzIGFyZW4ndCBhcyBvYnZpb3VzIHRvIGdldCByaWdodCBhcyB5b3Vcblx0XHRcdFx0XHQvLyB3b3VsZCBleHBlY3QuIFRoZXJlJ3MgYSBsb3QgbW9yZSB2YWxpZCB3YXlzIHRvIGNsaWNrIGFcblx0XHRcdFx0XHQvLyBsaW5rIHRoYW4gdGhpcywgYW5kIG9uZSBtaWdodCB3YW50IHRvIG5vdCBzaW1wbHkgY2xpY2sgYVxuXHRcdFx0XHRcdC8vIGxpbmssIGJ1dCByaWdodCBjbGljayBvciBjb21tYW5kLWNsaWNrIGl0IHRvIGNvcHkgdGhlXG5cdFx0XHRcdFx0Ly8gbGluayB0YXJnZXQsIGV0Yy4gTm9wZSwgdGhpcyBpc24ndCBqdXN0IGZvciBibGluZCBwZW9wbGUuXG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0Ly8gU2tpcCBpZiBgb25jbGlja2AgcHJldmVudGVkIGRlZmF1bHRcblx0XHRcdFx0XHRcdHJlc3VsdCAhPT0gZmFsc2UgJiYgIWUuZGVmYXVsdFByZXZlbnRlZCAmJlxuXHRcdFx0XHRcdFx0Ly8gSWdub3JlIGV2ZXJ5dGhpbmcgYnV0IGxlZnQgY2xpY2tzXG5cdFx0XHRcdFx0XHQoZS5idXR0b24gPT09IDAgfHwgZS53aGljaCA9PT0gMCB8fCBlLndoaWNoID09PSAxKSAmJlxuXHRcdFx0XHRcdFx0Ly8gTGV0IHRoZSBicm93c2VyIGhhbmRsZSBgdGFyZ2V0PV9ibGFua2AsIGV0Yy5cblx0XHRcdFx0XHRcdCghZS5jdXJyZW50VGFyZ2V0LnRhcmdldCB8fCBlLmN1cnJlbnRUYXJnZXQudGFyZ2V0ID09PSBcIl9zZWxmXCIpICYmXG5cdFx0XHRcdFx0XHQvLyBObyBtb2RpZmllciBrZXlzXG5cdFx0XHRcdFx0XHQhZS5jdHJsS2V5ICYmICFlLm1ldGFLZXkgJiYgIWUuc2hpZnRLZXkgJiYgIWUuYWx0S2V5XG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KClcblx0XHRcdFx0XHRcdGUucmVkcmF3ID0gZmFsc2Vcblx0XHRcdFx0XHRcdHJvdXRlLnNldChocmVmLCBudWxsLCBvcHRpb25zKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGNoaWxkXG5cdFx0fSxcblx0fVxuXHRyb3V0ZS5wYXJhbSA9IGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiBhdHRycyAmJiBrZXkgIT0gbnVsbCA/IGF0dHJzW2tleV0gOiBhdHRyc1xuXHR9XG5cblx0cmV0dXJuIHJvdXRlXG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgaHlwZXJzY3JpcHQgPSByZXF1aXJlKFwiLi9yZW5kZXIvaHlwZXJzY3JpcHRcIilcblxuaHlwZXJzY3JpcHQudHJ1c3QgPSByZXF1aXJlKFwiLi9yZW5kZXIvdHJ1c3RcIilcbmh5cGVyc2NyaXB0LmZyYWdtZW50ID0gcmVxdWlyZShcIi4vcmVuZGVyL2ZyYWdtZW50XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaHlwZXJzY3JpcHRcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBoeXBlcnNjcmlwdCA9IHJlcXVpcmUoXCIuL2h5cGVyc2NyaXB0XCIpXG52YXIgcmVxdWVzdCA9IHJlcXVpcmUoXCIuL3JlcXVlc3RcIilcbnZhciBtb3VudFJlZHJhdyA9IHJlcXVpcmUoXCIuL21vdW50LXJlZHJhd1wiKVxuXG52YXIgbSA9IGZ1bmN0aW9uIG0oKSB7IHJldHVybiBoeXBlcnNjcmlwdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpIH1cbm0ubSA9IGh5cGVyc2NyaXB0XG5tLnRydXN0ID0gaHlwZXJzY3JpcHQudHJ1c3Rcbm0uZnJhZ21lbnQgPSBoeXBlcnNjcmlwdC5mcmFnbWVudFxubS5tb3VudCA9IG1vdW50UmVkcmF3Lm1vdW50XG5tLnJvdXRlID0gcmVxdWlyZShcIi4vcm91dGVcIilcbm0ucmVuZGVyID0gcmVxdWlyZShcIi4vcmVuZGVyXCIpXG5tLnJlZHJhdyA9IG1vdW50UmVkcmF3LnJlZHJhd1xubS5yZXF1ZXN0ID0gcmVxdWVzdC5yZXF1ZXN0XG5tLmpzb25wID0gcmVxdWVzdC5qc29ucFxubS5wYXJzZVF1ZXJ5U3RyaW5nID0gcmVxdWlyZShcIi4vcXVlcnlzdHJpbmcvcGFyc2VcIilcbm0uYnVpbGRRdWVyeVN0cmluZyA9IHJlcXVpcmUoXCIuL3F1ZXJ5c3RyaW5nL2J1aWxkXCIpXG5tLnBhcnNlUGF0aG5hbWUgPSByZXF1aXJlKFwiLi9wYXRobmFtZS9wYXJzZVwiKVxubS5idWlsZFBhdGhuYW1lID0gcmVxdWlyZShcIi4vcGF0aG5hbWUvYnVpbGRcIilcbm0udm5vZGUgPSByZXF1aXJlKFwiLi9yZW5kZXIvdm5vZGVcIilcbm0uUHJvbWlzZVBvbHlmaWxsID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wb2x5ZmlsbFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciByZW5kZXIgPSByZXF1aXJlKFwiLi9yZW5kZXJcIilcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9hcGkvbW91bnQtcmVkcmF3XCIpKHJlbmRlciwgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLCBjb25zb2xlKVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uKHRhcmdldCwgc291cmNlKSB7XG5cdGlmKHNvdXJjZSkgT2JqZWN0LmtleXMoc291cmNlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldIH0pXG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgYnVpbGRRdWVyeVN0cmluZyA9IHJlcXVpcmUoXCIuLi9xdWVyeXN0cmluZy9idWlsZFwiKVxudmFyIGFzc2lnbiA9IHJlcXVpcmUoXCIuL2Fzc2lnblwiKVxuXG4vLyBSZXR1cm5zIGBwYXRoYCBmcm9tIGB0ZW1wbGF0ZWAgKyBgcGFyYW1zYFxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0ZW1wbGF0ZSwgcGFyYW1zKSB7XG5cdGlmICgoLzooW15cXC9cXC4tXSspKFxcLnszfSk/Oi8pLnRlc3QodGVtcGxhdGUpKSB7XG5cdFx0dGhyb3cgbmV3IFN5bnRheEVycm9yKFwiVGVtcGxhdGUgcGFyYW1ldGVyIG5hbWVzICptdXN0KiBiZSBzZXBhcmF0ZWRcIilcblx0fVxuXHRpZiAocGFyYW1zID09IG51bGwpIHJldHVybiB0ZW1wbGF0ZVxuXHR2YXIgcXVlcnlJbmRleCA9IHRlbXBsYXRlLmluZGV4T2YoXCI/XCIpXG5cdHZhciBoYXNoSW5kZXggPSB0ZW1wbGF0ZS5pbmRleE9mKFwiI1wiKVxuXHR2YXIgcXVlcnlFbmQgPSBoYXNoSW5kZXggPCAwID8gdGVtcGxhdGUubGVuZ3RoIDogaGFzaEluZGV4XG5cdHZhciBwYXRoRW5kID0gcXVlcnlJbmRleCA8IDAgPyBxdWVyeUVuZCA6IHF1ZXJ5SW5kZXhcblx0dmFyIHBhdGggPSB0ZW1wbGF0ZS5zbGljZSgwLCBwYXRoRW5kKVxuXHR2YXIgcXVlcnkgPSB7fVxuXG5cdGFzc2lnbihxdWVyeSwgcGFyYW1zKVxuXG5cdHZhciByZXNvbHZlZCA9IHBhdGgucmVwbGFjZSgvOihbXlxcL1xcLi1dKykoXFwuezN9KT8vZywgZnVuY3Rpb24obSwga2V5LCB2YXJpYWRpYykge1xuXHRcdGRlbGV0ZSBxdWVyeVtrZXldXG5cdFx0Ly8gSWYgbm8gc3VjaCBwYXJhbWV0ZXIgZXhpc3RzLCBkb24ndCBpbnRlcnBvbGF0ZSBpdC5cblx0XHRpZiAocGFyYW1zW2tleV0gPT0gbnVsbCkgcmV0dXJuIG1cblx0XHQvLyBFc2NhcGUgbm9ybWFsIHBhcmFtZXRlcnMsIGJ1dCBub3QgdmFyaWFkaWMgb25lcy5cblx0XHRyZXR1cm4gdmFyaWFkaWMgPyBwYXJhbXNba2V5XSA6IGVuY29kZVVSSUNvbXBvbmVudChTdHJpbmcocGFyYW1zW2tleV0pKVxuXHR9KVxuXG5cdC8vIEluIGNhc2UgdGhlIHRlbXBsYXRlIHN1YnN0aXR1dGlvbiBhZGRzIG5ldyBxdWVyeS9oYXNoIHBhcmFtZXRlcnMuXG5cdHZhciBuZXdRdWVyeUluZGV4ID0gcmVzb2x2ZWQuaW5kZXhPZihcIj9cIilcblx0dmFyIG5ld0hhc2hJbmRleCA9IHJlc29sdmVkLmluZGV4T2YoXCIjXCIpXG5cdHZhciBuZXdRdWVyeUVuZCA9IG5ld0hhc2hJbmRleCA8IDAgPyByZXNvbHZlZC5sZW5ndGggOiBuZXdIYXNoSW5kZXhcblx0dmFyIG5ld1BhdGhFbmQgPSBuZXdRdWVyeUluZGV4IDwgMCA/IG5ld1F1ZXJ5RW5kIDogbmV3UXVlcnlJbmRleFxuXHR2YXIgcmVzdWx0ID0gcmVzb2x2ZWQuc2xpY2UoMCwgbmV3UGF0aEVuZClcblxuXHRpZiAocXVlcnlJbmRleCA+PSAwKSByZXN1bHQgKz0gdGVtcGxhdGUuc2xpY2UocXVlcnlJbmRleCwgcXVlcnlFbmQpXG5cdGlmIChuZXdRdWVyeUluZGV4ID49IDApIHJlc3VsdCArPSAocXVlcnlJbmRleCA8IDAgPyBcIj9cIiA6IFwiJlwiKSArIHJlc29sdmVkLnNsaWNlKG5ld1F1ZXJ5SW5kZXgsIG5ld1F1ZXJ5RW5kKVxuXHR2YXIgcXVlcnlzdHJpbmcgPSBidWlsZFF1ZXJ5U3RyaW5nKHF1ZXJ5KVxuXHRpZiAocXVlcnlzdHJpbmcpIHJlc3VsdCArPSAocXVlcnlJbmRleCA8IDAgJiYgbmV3UXVlcnlJbmRleCA8IDAgPyBcIj9cIiA6IFwiJlwiKSArIHF1ZXJ5c3RyaW5nXG5cdGlmIChoYXNoSW5kZXggPj0gMCkgcmVzdWx0ICs9IHRlbXBsYXRlLnNsaWNlKGhhc2hJbmRleClcblx0aWYgKG5ld0hhc2hJbmRleCA+PSAwKSByZXN1bHQgKz0gKGhhc2hJbmRleCA8IDAgPyBcIlwiIDogXCImXCIpICsgcmVzb2x2ZWQuc2xpY2UobmV3SGFzaEluZGV4KVxuXHRyZXR1cm4gcmVzdWx0XG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgcGFyc2VQYXRobmFtZSA9IHJlcXVpcmUoXCIuL3BhcnNlXCIpXG5cbi8vIENvbXBpbGVzIGEgdGVtcGxhdGUgaW50byBhIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYSByZXNvbHZlZCBwYXRoICh3aXRob3V0IHF1ZXJ5XG4vLyBzdHJpbmdzKSBhbmQgcmV0dXJucyBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgdGVtcGxhdGUgcGFyYW1ldGVycyB3aXRoIHRoZWlyXG4vLyBwYXJzZWQgdmFsdWVzLiBUaGlzIGV4cGVjdHMgdGhlIGlucHV0IG9mIHRoZSBjb21waWxlZCB0ZW1wbGF0ZSB0byBiZSB0aGVcbi8vIG91dHB1dCBvZiBgcGFyc2VQYXRobmFtZWAuIE5vdGUgdGhhdCBpdCBkb2VzICpub3QqIHJlbW92ZSBxdWVyeSBwYXJhbWV0ZXJzXG4vLyBzcGVjaWZpZWQgaW4gdGhlIHRlbXBsYXRlLlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0ZW1wbGF0ZSkge1xuXHR2YXIgdGVtcGxhdGVEYXRhID0gcGFyc2VQYXRobmFtZSh0ZW1wbGF0ZSlcblx0dmFyIHRlbXBsYXRlS2V5cyA9IE9iamVjdC5rZXlzKHRlbXBsYXRlRGF0YS5wYXJhbXMpXG5cdHZhciBrZXlzID0gW11cblx0dmFyIHJlZ2V4cCA9IG5ldyBSZWdFeHAoXCJeXCIgKyB0ZW1wbGF0ZURhdGEucGF0aC5yZXBsYWNlKFxuXHRcdC8vIEkgZXNjYXBlIGxpdGVyYWwgdGV4dCBzbyBwZW9wbGUgY2FuIHVzZSB0aGluZ3MgbGlrZSBgOmZpbGUuOmV4dGAgb3Jcblx0XHQvLyBgOmxhbmctOmxvY2FsZWAgaW4gcm91dGVzLiBUaGlzIGlzIGFsbCBtZXJnZWQgaW50byBvbmUgcGFzcyBzbyBJXG5cdFx0Ly8gZG9uJ3QgYWxzbyBhY2NpZGVudGFsbHkgZXNjYXBlIGAtYCBhbmQgbWFrZSBpdCBoYXJkZXIgdG8gZGV0ZWN0IGl0IHRvXG5cdFx0Ly8gYmFuIGl0IGZyb20gdGVtcGxhdGUgcGFyYW1ldGVycy5cblx0XHQvOihbXlxcLy4tXSspKFxcLnszfXxcXC4oPyFcXC4pfC0pP3xbXFxcXF4kKisuKCl8XFxbXFxde31dL2csXG5cdFx0ZnVuY3Rpb24obSwga2V5LCBleHRyYSkge1xuXHRcdFx0aWYgKGtleSA9PSBudWxsKSByZXR1cm4gXCJcXFxcXCIgKyBtXG5cdFx0XHRrZXlzLnB1c2goe2s6IGtleSwgcjogZXh0cmEgPT09IFwiLi4uXCJ9KVxuXHRcdFx0aWYgKGV4dHJhID09PSBcIi4uLlwiKSByZXR1cm4gXCIoLiopXCJcblx0XHRcdGlmIChleHRyYSA9PT0gXCIuXCIpIHJldHVybiBcIihbXi9dKylcXFxcLlwiXG5cdFx0XHRyZXR1cm4gXCIoW14vXSspXCIgKyAoZXh0cmEgfHwgXCJcIilcblx0XHR9XG5cdCkgKyBcIiRcIilcblx0cmV0dXJuIGZ1bmN0aW9uKGRhdGEpIHtcblx0XHQvLyBGaXJzdCwgY2hlY2sgdGhlIHBhcmFtcy4gVXN1YWxseSwgdGhlcmUgaXNuJ3QgYW55LCBhbmQgaXQncyBqdXN0XG5cdFx0Ly8gY2hlY2tpbmcgYSBzdGF0aWMgc2V0LlxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdGVtcGxhdGVLZXlzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGVtcGxhdGVEYXRhLnBhcmFtc1t0ZW1wbGF0ZUtleXNbaV1dICE9PSBkYXRhLnBhcmFtc1t0ZW1wbGF0ZUtleXNbaV1dKSByZXR1cm4gZmFsc2Vcblx0XHR9XG5cdFx0Ly8gSWYgbm8gaW50ZXJwb2xhdGlvbnMgZXhpc3QsIGxldCdzIHNraXAgYWxsIHRoZSBjZXJlbW9ueVxuXHRcdGlmICgha2V5cy5sZW5ndGgpIHJldHVybiByZWdleHAudGVzdChkYXRhLnBhdGgpXG5cdFx0dmFyIHZhbHVlcyA9IHJlZ2V4cC5leGVjKGRhdGEucGF0aClcblx0XHRpZiAodmFsdWVzID09IG51bGwpIHJldHVybiBmYWxzZVxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0ZGF0YS5wYXJhbXNba2V5c1tpXS5rXSA9IGtleXNbaV0uciA/IHZhbHVlc1tpICsgMV0gOiBkZWNvZGVVUklDb21wb25lbnQodmFsdWVzW2kgKyAxXSlcblx0XHR9XG5cdFx0cmV0dXJuIHRydWVcblx0fVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxudmFyIHBhcnNlUXVlcnlTdHJpbmcgPSByZXF1aXJlKFwiLi4vcXVlcnlzdHJpbmcvcGFyc2VcIilcblxuLy8gUmV0dXJucyBge3BhdGgsIHBhcmFtc31gIGZyb20gYHVybGBcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odXJsKSB7XG5cdHZhciBxdWVyeUluZGV4ID0gdXJsLmluZGV4T2YoXCI/XCIpXG5cdHZhciBoYXNoSW5kZXggPSB1cmwuaW5kZXhPZihcIiNcIilcblx0dmFyIHF1ZXJ5RW5kID0gaGFzaEluZGV4IDwgMCA/IHVybC5sZW5ndGggOiBoYXNoSW5kZXhcblx0dmFyIHBhdGhFbmQgPSBxdWVyeUluZGV4IDwgMCA/IHF1ZXJ5RW5kIDogcXVlcnlJbmRleFxuXHR2YXIgcGF0aCA9IHVybC5zbGljZSgwLCBwYXRoRW5kKS5yZXBsYWNlKC9cXC97Mix9L2csIFwiL1wiKVxuXG5cdGlmICghcGF0aCkgcGF0aCA9IFwiL1wiXG5cdGVsc2Uge1xuXHRcdGlmIChwYXRoWzBdICE9PSBcIi9cIikgcGF0aCA9IFwiL1wiICsgcGF0aFxuXHRcdGlmIChwYXRoLmxlbmd0aCA+IDEgJiYgcGF0aFtwYXRoLmxlbmd0aCAtIDFdID09PSBcIi9cIikgcGF0aCA9IHBhdGguc2xpY2UoMCwgLTEpXG5cdH1cblx0cmV0dXJuIHtcblx0XHRwYXRoOiBwYXRoLFxuXHRcdHBhcmFtczogcXVlcnlJbmRleCA8IDBcblx0XHRcdD8ge31cblx0XHRcdDogcGFyc2VRdWVyeVN0cmluZyh1cmwuc2xpY2UocXVlcnlJbmRleCArIDEsIHF1ZXJ5RW5kKSksXG5cdH1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG4vKiogQGNvbnN0cnVjdG9yICovXG52YXIgUHJvbWlzZVBvbHlmaWxsID0gZnVuY3Rpb24oZXhlY3V0b3IpIHtcblx0aWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2VQb2x5ZmlsbCkpIHRocm93IG5ldyBFcnJvcihcIlByb21pc2UgbXVzdCBiZSBjYWxsZWQgd2l0aCBgbmV3YFwiKVxuXHRpZiAodHlwZW9mIGV4ZWN1dG9yICE9PSBcImZ1bmN0aW9uXCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJleGVjdXRvciBtdXN0IGJlIGEgZnVuY3Rpb25cIilcblxuXHR2YXIgc2VsZiA9IHRoaXMsIHJlc29sdmVycyA9IFtdLCByZWplY3RvcnMgPSBbXSwgcmVzb2x2ZUN1cnJlbnQgPSBoYW5kbGVyKHJlc29sdmVycywgdHJ1ZSksIHJlamVjdEN1cnJlbnQgPSBoYW5kbGVyKHJlamVjdG9ycywgZmFsc2UpXG5cdHZhciBpbnN0YW5jZSA9IHNlbGYuX2luc3RhbmNlID0ge3Jlc29sdmVyczogcmVzb2x2ZXJzLCByZWplY3RvcnM6IHJlamVjdG9yc31cblx0dmFyIGNhbGxBc3luYyA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHNldEltbWVkaWF0ZSA6IHNldFRpbWVvdXRcblx0ZnVuY3Rpb24gaGFuZGxlcihsaXN0LCBzaG91bGRBYnNvcmIpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24gZXhlY3V0ZSh2YWx1ZSkge1xuXHRcdFx0dmFyIHRoZW5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmIChzaG91bGRBYnNvcmIgJiYgdmFsdWUgIT0gbnVsbCAmJiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSAmJiB0eXBlb2YgKHRoZW4gPSB2YWx1ZS50aGVuKSA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlID09PSBzZWxmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJvbWlzZSBjYW4ndCBiZSByZXNvbHZlZCB3LyBpdHNlbGZcIilcblx0XHRcdFx0XHRleGVjdXRlT25jZSh0aGVuLmJpbmQodmFsdWUpKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNhbGxBc3luYyhmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdGlmICghc2hvdWxkQWJzb3JiICYmIGxpc3QubGVuZ3RoID09PSAwKSBjb25zb2xlLmVycm9yKFwiUG9zc2libGUgdW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOlwiLCB2YWx1ZSlcblx0XHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykgbGlzdFtpXSh2YWx1ZSlcblx0XHRcdFx0XHRcdHJlc29sdmVycy5sZW5ndGggPSAwLCByZWplY3RvcnMubGVuZ3RoID0gMFxuXHRcdFx0XHRcdFx0aW5zdGFuY2Uuc3RhdGUgPSBzaG91bGRBYnNvcmJcblx0XHRcdFx0XHRcdGluc3RhbmNlLnJldHJ5ID0gZnVuY3Rpb24oKSB7ZXhlY3V0ZSh2YWx1ZSl9XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y2F0Y2ggKGUpIHtcblx0XHRcdFx0cmVqZWN0Q3VycmVudChlKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBleGVjdXRlT25jZSh0aGVuKSB7XG5cdFx0dmFyIHJ1bnMgPSAwXG5cdFx0ZnVuY3Rpb24gcnVuKGZuKSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKHJ1bnMrKyA+IDApIHJldHVyblxuXHRcdFx0XHRmbih2YWx1ZSlcblx0XHRcdH1cblx0XHR9XG5cdFx0dmFyIG9uZXJyb3IgPSBydW4ocmVqZWN0Q3VycmVudClcblx0XHR0cnkge3RoZW4ocnVuKHJlc29sdmVDdXJyZW50KSwgb25lcnJvcil9IGNhdGNoIChlKSB7b25lcnJvcihlKX1cblx0fVxuXG5cdGV4ZWN1dGVPbmNlKGV4ZWN1dG9yKVxufVxuUHJvbWlzZVBvbHlmaWxsLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0aW9uKSB7XG5cdHZhciBzZWxmID0gdGhpcywgaW5zdGFuY2UgPSBzZWxmLl9pbnN0YW5jZVxuXHRmdW5jdGlvbiBoYW5kbGUoY2FsbGJhY2ssIGxpc3QsIG5leHQsIHN0YXRlKSB7XG5cdFx0bGlzdC5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRpZiAodHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIG5leHQodmFsdWUpXG5cdFx0XHRlbHNlIHRyeSB7cmVzb2x2ZU5leHQoY2FsbGJhY2sodmFsdWUpKX0gY2F0Y2ggKGUpIHtpZiAocmVqZWN0TmV4dCkgcmVqZWN0TmV4dChlKX1cblx0XHR9KVxuXHRcdGlmICh0eXBlb2YgaW5zdGFuY2UucmV0cnkgPT09IFwiZnVuY3Rpb25cIiAmJiBzdGF0ZSA9PT0gaW5zdGFuY2Uuc3RhdGUpIGluc3RhbmNlLnJldHJ5KClcblx0fVxuXHR2YXIgcmVzb2x2ZU5leHQsIHJlamVjdE5leHRcblx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZVBvbHlmaWxsKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge3Jlc29sdmVOZXh0ID0gcmVzb2x2ZSwgcmVqZWN0TmV4dCA9IHJlamVjdH0pXG5cdGhhbmRsZShvbkZ1bGZpbGxlZCwgaW5zdGFuY2UucmVzb2x2ZXJzLCByZXNvbHZlTmV4dCwgdHJ1ZSksIGhhbmRsZShvblJlamVjdGlvbiwgaW5zdGFuY2UucmVqZWN0b3JzLCByZWplY3ROZXh0LCBmYWxzZSlcblx0cmV0dXJuIHByb21pc2Vcbn1cblByb21pc2VQb2x5ZmlsbC5wcm90b3R5cGUuY2F0Y2ggPSBmdW5jdGlvbihvblJlamVjdGlvbikge1xuXHRyZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKVxufVxuUHJvbWlzZVBvbHlmaWxsLnByb3RvdHlwZS5maW5hbGx5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0cmV0dXJuIHRoaXMudGhlbihcblx0XHRmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2VQb2x5ZmlsbC5yZXNvbHZlKGNhbGxiYWNrKCkpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZVxuXHRcdFx0fSlcblx0XHR9LFxuXHRcdGZ1bmN0aW9uKHJlYXNvbikge1xuXHRcdFx0cmV0dXJuIFByb21pc2VQb2x5ZmlsbC5yZXNvbHZlKGNhbGxiYWNrKCkpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlUG9seWZpbGwucmVqZWN0KHJlYXNvbik7XG5cdFx0XHR9KVxuXHRcdH1cblx0KVxufVxuUHJvbWlzZVBvbHlmaWxsLnJlc29sdmUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXHRpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlUG9seWZpbGwpIHJldHVybiB2YWx1ZVxuXHRyZXR1cm4gbmV3IFByb21pc2VQb2x5ZmlsbChmdW5jdGlvbihyZXNvbHZlKSB7cmVzb2x2ZSh2YWx1ZSl9KVxufVxuUHJvbWlzZVBvbHlmaWxsLnJlamVjdCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZVBvbHlmaWxsKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge3JlamVjdCh2YWx1ZSl9KVxufVxuUHJvbWlzZVBvbHlmaWxsLmFsbCA9IGZ1bmN0aW9uKGxpc3QpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlUG9seWZpbGwoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0dmFyIHRvdGFsID0gbGlzdC5sZW5ndGgsIGNvdW50ID0gMCwgdmFsdWVzID0gW11cblx0XHRpZiAobGlzdC5sZW5ndGggPT09IDApIHJlc29sdmUoW10pXG5cdFx0ZWxzZSBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcblx0XHRcdChmdW5jdGlvbihpKSB7XG5cdFx0XHRcdGZ1bmN0aW9uIGNvbnN1bWUodmFsdWUpIHtcblx0XHRcdFx0XHRjb3VudCsrXG5cdFx0XHRcdFx0dmFsdWVzW2ldID0gdmFsdWVcblx0XHRcdFx0XHRpZiAoY291bnQgPT09IHRvdGFsKSByZXNvbHZlKHZhbHVlcylcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGlzdFtpXSAhPSBudWxsICYmICh0eXBlb2YgbGlzdFtpXSA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgbGlzdFtpXSA9PT0gXCJmdW5jdGlvblwiKSAmJiB0eXBlb2YgbGlzdFtpXS50aGVuID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHRsaXN0W2ldLnRoZW4oY29uc3VtZSwgcmVqZWN0KVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgY29uc3VtZShsaXN0W2ldKVxuXHRcdFx0fSkoaSlcblx0XHR9XG5cdH0pXG59XG5Qcm9taXNlUG9seWZpbGwucmFjZSA9IGZ1bmN0aW9uKGxpc3QpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlUG9seWZpbGwoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRsaXN0W2ldLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KVxuXHRcdH1cblx0fSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQcm9taXNlUG9seWZpbGxcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBQcm9taXNlUG9seWZpbGwgPSByZXF1aXJlKFwiLi9wb2x5ZmlsbFwiKVxuXG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRpZiAodHlwZW9mIHdpbmRvdy5Qcm9taXNlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0d2luZG93LlByb21pc2UgPSBQcm9taXNlUG9seWZpbGxcblx0fSBlbHNlIGlmICghd2luZG93LlByb21pc2UucHJvdG90eXBlLmZpbmFsbHkpIHtcblx0XHR3aW5kb3cuUHJvbWlzZS5wcm90b3R5cGUuZmluYWxseSA9IFByb21pc2VQb2x5ZmlsbC5wcm90b3R5cGUuZmluYWxseVxuXHR9XG5cdG1vZHVsZS5leHBvcnRzID0gd2luZG93LlByb21pc2Vcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRpZiAodHlwZW9mIGdsb2JhbC5Qcm9taXNlID09PSBcInVuZGVmaW5lZFwiKSB7XG5cdFx0Z2xvYmFsLlByb21pc2UgPSBQcm9taXNlUG9seWZpbGxcblx0fSBlbHNlIGlmICghZ2xvYmFsLlByb21pc2UucHJvdG90eXBlLmZpbmFsbHkpIHtcblx0XHRnbG9iYWwuUHJvbWlzZS5wcm90b3R5cGUuZmluYWxseSA9IFByb21pc2VQb2x5ZmlsbC5wcm90b3R5cGUuZmluYWxseVxuXHR9XG5cdG1vZHVsZS5leHBvcnRzID0gZ2xvYmFsLlByb21pc2Vcbn0gZWxzZSB7XG5cdG1vZHVsZS5leHBvcnRzID0gUHJvbWlzZVBvbHlmaWxsXG59XG4iLCJcInVzZSBzdHJpY3RcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuXHRpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgIT09IFwiW29iamVjdCBPYmplY3RdXCIpIHJldHVybiBcIlwiXG5cblx0dmFyIGFyZ3MgPSBbXVxuXHRmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG5cdFx0ZGVzdHJ1Y3R1cmUoa2V5LCBvYmplY3Rba2V5XSlcblx0fVxuXG5cdHJldHVybiBhcmdzLmpvaW4oXCImXCIpXG5cblx0ZnVuY3Rpb24gZGVzdHJ1Y3R1cmUoa2V5LCB2YWx1ZSkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRkZXN0cnVjdHVyZShrZXkgKyBcIltcIiArIGkgKyBcIl1cIiwgdmFsdWVbaV0pXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09IFwiW29iamVjdCBPYmplY3RdXCIpIHtcblx0XHRcdGZvciAodmFyIGkgaW4gdmFsdWUpIHtcblx0XHRcdFx0ZGVzdHJ1Y3R1cmUoa2V5ICsgXCJbXCIgKyBpICsgXCJdXCIsIHZhbHVlW2ldKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGFyZ3MucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICh2YWx1ZSAhPSBudWxsICYmIHZhbHVlICE9PSBcIlwiID8gXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpIDogXCJcIikpXG5cdH1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc3RyaW5nKSB7XG5cdGlmIChzdHJpbmcgPT09IFwiXCIgfHwgc3RyaW5nID09IG51bGwpIHJldHVybiB7fVxuXHRpZiAoc3RyaW5nLmNoYXJBdCgwKSA9PT0gXCI/XCIpIHN0cmluZyA9IHN0cmluZy5zbGljZSgxKVxuXG5cdHZhciBlbnRyaWVzID0gc3RyaW5nLnNwbGl0KFwiJlwiKSwgY291bnRlcnMgPSB7fSwgZGF0YSA9IHt9XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgZW50cmllcy5sZW5ndGg7IGkrKykge1xuXHRcdHZhciBlbnRyeSA9IGVudHJpZXNbaV0uc3BsaXQoXCI9XCIpXG5cdFx0dmFyIGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChlbnRyeVswXSlcblx0XHR2YXIgdmFsdWUgPSBlbnRyeS5sZW5ndGggPT09IDIgPyBkZWNvZGVVUklDb21wb25lbnQoZW50cnlbMV0pIDogXCJcIlxuXG5cdFx0aWYgKHZhbHVlID09PSBcInRydWVcIikgdmFsdWUgPSB0cnVlXG5cdFx0ZWxzZSBpZiAodmFsdWUgPT09IFwiZmFsc2VcIikgdmFsdWUgPSBmYWxzZVxuXG5cdFx0dmFyIGxldmVscyA9IGtleS5zcGxpdCgvXFxdXFxbP3xcXFsvKVxuXHRcdHZhciBjdXJzb3IgPSBkYXRhXG5cdFx0aWYgKGtleS5pbmRleE9mKFwiW1wiKSA+IC0xKSBsZXZlbHMucG9wKClcblx0XHRmb3IgKHZhciBqID0gMDsgaiA8IGxldmVscy5sZW5ndGg7IGorKykge1xuXHRcdFx0dmFyIGxldmVsID0gbGV2ZWxzW2pdLCBuZXh0TGV2ZWwgPSBsZXZlbHNbaiArIDFdXG5cdFx0XHR2YXIgaXNOdW1iZXIgPSBuZXh0TGV2ZWwgPT0gXCJcIiB8fCAhaXNOYU4ocGFyc2VJbnQobmV4dExldmVsLCAxMCkpXG5cdFx0XHRpZiAobGV2ZWwgPT09IFwiXCIpIHtcblx0XHRcdFx0dmFyIGtleSA9IGxldmVscy5zbGljZSgwLCBqKS5qb2luKClcblx0XHRcdFx0aWYgKGNvdW50ZXJzW2tleV0gPT0gbnVsbCkge1xuXHRcdFx0XHRcdGNvdW50ZXJzW2tleV0gPSBBcnJheS5pc0FycmF5KGN1cnNvcikgPyBjdXJzb3IubGVuZ3RoIDogMFxuXHRcdFx0XHR9XG5cdFx0XHRcdGxldmVsID0gY291bnRlcnNba2V5XSsrXG5cdFx0XHR9XG5cdFx0XHQvLyBEaXNhbGxvdyBkaXJlY3QgcHJvdG90eXBlIHBvbGx1dGlvblxuXHRcdFx0ZWxzZSBpZiAobGV2ZWwgPT09IFwiX19wcm90b19fXCIpIGJyZWFrXG5cdFx0XHRpZiAoaiA9PT0gbGV2ZWxzLmxlbmd0aCAtIDEpIGN1cnNvcltsZXZlbF0gPSB2YWx1ZVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdC8vIFJlYWQgb3duIHByb3BlcnRpZXMgZXhjbHVzaXZlbHkgdG8gZGlzYWxsb3cgaW5kaXJlY3Rcblx0XHRcdFx0Ly8gcHJvdG90eXBlIHBvbGx1dGlvblxuXHRcdFx0XHR2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY3Vyc29yLCBsZXZlbClcblx0XHRcdFx0aWYgKGRlc2MgIT0gbnVsbCkgZGVzYyA9IGRlc2MudmFsdWVcblx0XHRcdFx0aWYgKGRlc2MgPT0gbnVsbCkgY3Vyc29yW2xldmVsXSA9IGRlc2MgPSBpc051bWJlciA/IFtdIDoge31cblx0XHRcdFx0Y3Vyc29yID0gZGVzY1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gZGF0YVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9yZW5kZXIvcmVuZGVyXCIpKHdpbmRvdylcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcbnZhciBoeXBlcnNjcmlwdFZub2RlID0gcmVxdWlyZShcIi4vaHlwZXJzY3JpcHRWbm9kZVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgdm5vZGUgPSBoeXBlcnNjcmlwdFZub2RlLmFwcGx5KDAsIGFyZ3VtZW50cylcblxuXHR2bm9kZS50YWcgPSBcIltcIlxuXHR2bm9kZS5jaGlsZHJlbiA9IFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKHZub2RlLmNoaWxkcmVuKVxuXHRyZXR1cm4gdm5vZGVcbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcbnZhciBoeXBlcnNjcmlwdFZub2RlID0gcmVxdWlyZShcIi4vaHlwZXJzY3JpcHRWbm9kZVwiKVxuXG52YXIgc2VsZWN0b3JQYXJzZXIgPSAvKD86KF58I3xcXC4pKFteI1xcLlxcW1xcXV0rKSl8KFxcWyguKz8pKD86XFxzKj1cXHMqKFwifCd8KSgoPzpcXFxcW1wiJ1xcXV18LikqPylcXDUpP1xcXSkvZ1xudmFyIHNlbGVjdG9yQ2FjaGUgPSB7fVxudmFyIGhhc093biA9IHt9Lmhhc093blByb3BlcnR5XG5cbmZ1bmN0aW9uIGlzRW1wdHkob2JqZWN0KSB7XG5cdGZvciAodmFyIGtleSBpbiBvYmplY3QpIGlmIChoYXNPd24uY2FsbChvYmplY3QsIGtleSkpIHJldHVybiBmYWxzZVxuXHRyZXR1cm4gdHJ1ZVxufVxuXG5mdW5jdGlvbiBjb21waWxlU2VsZWN0b3Ioc2VsZWN0b3IpIHtcblx0dmFyIG1hdGNoLCB0YWcgPSBcImRpdlwiLCBjbGFzc2VzID0gW10sIGF0dHJzID0ge31cblx0d2hpbGUgKG1hdGNoID0gc2VsZWN0b3JQYXJzZXIuZXhlYyhzZWxlY3RvcikpIHtcblx0XHR2YXIgdHlwZSA9IG1hdGNoWzFdLCB2YWx1ZSA9IG1hdGNoWzJdXG5cdFx0aWYgKHR5cGUgPT09IFwiXCIgJiYgdmFsdWUgIT09IFwiXCIpIHRhZyA9IHZhbHVlXG5cdFx0ZWxzZSBpZiAodHlwZSA9PT0gXCIjXCIpIGF0dHJzLmlkID0gdmFsdWVcblx0XHRlbHNlIGlmICh0eXBlID09PSBcIi5cIikgY2xhc3Nlcy5wdXNoKHZhbHVlKVxuXHRcdGVsc2UgaWYgKG1hdGNoWzNdWzBdID09PSBcIltcIikge1xuXHRcdFx0dmFyIGF0dHJWYWx1ZSA9IG1hdGNoWzZdXG5cdFx0XHRpZiAoYXR0clZhbHVlKSBhdHRyVmFsdWUgPSBhdHRyVmFsdWUucmVwbGFjZSgvXFxcXChbXCInXSkvZywgXCIkMVwiKS5yZXBsYWNlKC9cXFxcXFxcXC9nLCBcIlxcXFxcIilcblx0XHRcdGlmIChtYXRjaFs0XSA9PT0gXCJjbGFzc1wiKSBjbGFzc2VzLnB1c2goYXR0clZhbHVlKVxuXHRcdFx0ZWxzZSBhdHRyc1ttYXRjaFs0XV0gPSBhdHRyVmFsdWUgPT09IFwiXCIgPyBhdHRyVmFsdWUgOiBhdHRyVmFsdWUgfHwgdHJ1ZVxuXHRcdH1cblx0fVxuXHRpZiAoY2xhc3Nlcy5sZW5ndGggPiAwKSBhdHRycy5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oXCIgXCIpXG5cdHJldHVybiBzZWxlY3RvckNhY2hlW3NlbGVjdG9yXSA9IHt0YWc6IHRhZywgYXR0cnM6IGF0dHJzfVxufVxuXG5mdW5jdGlvbiBleGVjU2VsZWN0b3Ioc3RhdGUsIHZub2RlKSB7XG5cdHZhciBhdHRycyA9IHZub2RlLmF0dHJzXG5cdHZhciBjaGlsZHJlbiA9IFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKHZub2RlLmNoaWxkcmVuKVxuXHR2YXIgaGFzQ2xhc3MgPSBoYXNPd24uY2FsbChhdHRycywgXCJjbGFzc1wiKVxuXHR2YXIgY2xhc3NOYW1lID0gaGFzQ2xhc3MgPyBhdHRycy5jbGFzcyA6IGF0dHJzLmNsYXNzTmFtZVxuXG5cdHZub2RlLnRhZyA9IHN0YXRlLnRhZ1xuXHR2bm9kZS5hdHRycyA9IG51bGxcblx0dm5vZGUuY2hpbGRyZW4gPSB1bmRlZmluZWRcblxuXHRpZiAoIWlzRW1wdHkoc3RhdGUuYXR0cnMpICYmICFpc0VtcHR5KGF0dHJzKSkge1xuXHRcdHZhciBuZXdBdHRycyA9IHt9XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcblx0XHRcdGlmIChoYXNPd24uY2FsbChhdHRycywga2V5KSkgbmV3QXR0cnNba2V5XSA9IGF0dHJzW2tleV1cblx0XHR9XG5cblx0XHRhdHRycyA9IG5ld0F0dHJzXG5cdH1cblxuXHRmb3IgKHZhciBrZXkgaW4gc3RhdGUuYXR0cnMpIHtcblx0XHRpZiAoaGFzT3duLmNhbGwoc3RhdGUuYXR0cnMsIGtleSkgJiYga2V5ICE9PSBcImNsYXNzTmFtZVwiICYmICFoYXNPd24uY2FsbChhdHRycywga2V5KSl7XG5cdFx0XHRhdHRyc1trZXldID0gc3RhdGUuYXR0cnNba2V5XVxuXHRcdH1cblx0fVxuXHRpZiAoY2xhc3NOYW1lICE9IG51bGwgfHwgc3RhdGUuYXR0cnMuY2xhc3NOYW1lICE9IG51bGwpIGF0dHJzLmNsYXNzTmFtZSA9XG5cdFx0Y2xhc3NOYW1lICE9IG51bGxcblx0XHRcdD8gc3RhdGUuYXR0cnMuY2xhc3NOYW1lICE9IG51bGxcblx0XHRcdFx0PyBTdHJpbmcoc3RhdGUuYXR0cnMuY2xhc3NOYW1lKSArIFwiIFwiICsgU3RyaW5nKGNsYXNzTmFtZSlcblx0XHRcdFx0OiBjbGFzc05hbWVcblx0XHRcdDogc3RhdGUuYXR0cnMuY2xhc3NOYW1lICE9IG51bGxcblx0XHRcdFx0PyBzdGF0ZS5hdHRycy5jbGFzc05hbWVcblx0XHRcdFx0OiBudWxsXG5cblx0aWYgKGhhc0NsYXNzKSBhdHRycy5jbGFzcyA9IG51bGxcblxuXHRmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcblx0XHRpZiAoaGFzT3duLmNhbGwoYXR0cnMsIGtleSkgJiYga2V5ICE9PSBcImtleVwiKSB7XG5cdFx0XHR2bm9kZS5hdHRycyA9IGF0dHJzXG5cdFx0XHRicmVha1xuXHRcdH1cblx0fVxuXG5cdGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSAmJiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5bMF0gIT0gbnVsbCAmJiBjaGlsZHJlblswXS50YWcgPT09IFwiI1wiKSB7XG5cdFx0dm5vZGUudGV4dCA9IGNoaWxkcmVuWzBdLmNoaWxkcmVuXG5cdH0gZWxzZSB7XG5cdFx0dm5vZGUuY2hpbGRyZW4gPSBjaGlsZHJlblxuXHR9XG5cblx0cmV0dXJuIHZub2RlXG59XG5cbmZ1bmN0aW9uIGh5cGVyc2NyaXB0KHNlbGVjdG9yKSB7XG5cdGlmIChzZWxlY3RvciA9PSBudWxsIHx8IHR5cGVvZiBzZWxlY3RvciAhPT0gXCJzdHJpbmdcIiAmJiB0eXBlb2Ygc2VsZWN0b3IgIT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2Ygc2VsZWN0b3IudmlldyAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJUaGUgc2VsZWN0b3IgbXVzdCBiZSBlaXRoZXIgYSBzdHJpbmcgb3IgYSBjb21wb25lbnQuXCIpO1xuXHR9XG5cblx0dmFyIHZub2RlID0gaHlwZXJzY3JpcHRWbm9kZS5hcHBseSgxLCBhcmd1bWVudHMpXG5cblx0aWYgKHR5cGVvZiBzZWxlY3RvciA9PT0gXCJzdHJpbmdcIikge1xuXHRcdHZub2RlLmNoaWxkcmVuID0gVm5vZGUubm9ybWFsaXplQ2hpbGRyZW4odm5vZGUuY2hpbGRyZW4pXG5cdFx0aWYgKHNlbGVjdG9yICE9PSBcIltcIikgcmV0dXJuIGV4ZWNTZWxlY3RvcihzZWxlY3RvckNhY2hlW3NlbGVjdG9yXSB8fCBjb21waWxlU2VsZWN0b3Ioc2VsZWN0b3IpLCB2bm9kZSlcblx0fVxuXG5cdHZub2RlLnRhZyA9IHNlbGVjdG9yXG5cdHJldHVybiB2bm9kZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGh5cGVyc2NyaXB0XG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgVm5vZGUgPSByZXF1aXJlKFwiLi4vcmVuZGVyL3Zub2RlXCIpXG5cbi8vIENhbGwgdmlhIGBoeXBlcnNjcmlwdFZub2RlLmFwcGx5KHN0YXJ0T2Zmc2V0LCBhcmd1bWVudHMpYFxuLy9cbi8vIFRoZSByZWFzb24gSSBkbyBpdCB0aGlzIHdheSwgZm9yd2FyZGluZyB0aGUgYXJndW1lbnRzIGFuZCBwYXNzaW5nIHRoZSBzdGFydFxuLy8gb2Zmc2V0IGluIGB0aGlzYCwgaXMgc28gSSBkb24ndCBoYXZlIHRvIGNyZWF0ZSBhIHRlbXBvcmFyeSBhcnJheSBpbiBhXG4vLyBwZXJmb3JtYW5jZS1jcml0aWNhbCBwYXRoLlxuLy9cbi8vIEluIG5hdGl2ZSBFUzYsIEknZCBpbnN0ZWFkIGFkZCBhIGZpbmFsIGAuLi5hcmdzYCBwYXJhbWV0ZXIgdG8gdGhlXG4vLyBgaHlwZXJzY3JpcHRgIGFuZCBgZnJhZ21lbnRgIGZhY3RvcmllcyBhbmQgZGVmaW5lIHRoaXMgYXNcbi8vIGBoeXBlcnNjcmlwdFZub2RlKC4uLmFyZ3MpYCwgc2luY2UgbW9kZXJuIGVuZ2luZXMgZG8gb3B0aW1pemUgdGhhdCBhd2F5LiBCdXRcbi8vIEVTNSAod2hhdCBNaXRocmlsIHJlcXVpcmVzIHRoYW5rcyB0byBJRSBzdXBwb3J0KSBkb2Vzbid0IGdpdmUgbWUgdGhhdCBsdXh1cnksXG4vLyBhbmQgZW5naW5lcyBhcmVuJ3QgbmVhcmx5IGludGVsbGlnZW50IGVub3VnaCB0byBkbyBlaXRoZXIgb2YgdGhlc2U6XG4vL1xuLy8gMS4gRWxpZGUgdGhlIGFsbG9jYXRpb24gZm9yIGBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlgIHdoZW4gaXQncyBwYXNzZWQgdG9cbi8vICAgIGFub3RoZXIgZnVuY3Rpb24gb25seSB0byBiZSBpbmRleGVkLlxuLy8gMi4gRWxpZGUgYW4gYGFyZ3VtZW50c2AgYWxsb2NhdGlvbiB3aGVuIGl0J3MgcGFzc2VkIHRvIGFueSBmdW5jdGlvbiBvdGhlclxuLy8gICAgdGhhbiBgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5YCBvciBgUmVmbGVjdC5hcHBseWAuXG4vL1xuLy8gSW4gRVM2LCBpdCdkIHByb2JhYmx5IGxvb2sgY2xvc2VyIHRvIHRoaXMgKEknZCBuZWVkIHRvIHByb2ZpbGUgaXQsIHRob3VnaCk6XG4vLyBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGF0dHJzLCAuLi5jaGlsZHJlbikge1xuLy8gICAgIGlmIChhdHRycyA9PSBudWxsIHx8IHR5cGVvZiBhdHRycyA9PT0gXCJvYmplY3RcIiAmJiBhdHRycy50YWcgPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheShhdHRycykpIHtcbi8vICAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA9PT0gMSAmJiBBcnJheS5pc0FycmF5KGNoaWxkcmVuWzBdKSkgY2hpbGRyZW4gPSBjaGlsZHJlblswXVxuLy8gICAgIH0gZWxzZSB7XG4vLyAgICAgICAgIGNoaWxkcmVuID0gY2hpbGRyZW4ubGVuZ3RoID09PSAwICYmIEFycmF5LmlzQXJyYXkoYXR0cnMpID8gYXR0cnMgOiBbYXR0cnMsIC4uLmNoaWxkcmVuXVxuLy8gICAgICAgICBhdHRycyA9IHVuZGVmaW5lZFxuLy8gICAgIH1cbi8vXG4vLyAgICAgaWYgKGF0dHJzID09IG51bGwpIGF0dHJzID0ge31cbi8vICAgICByZXR1cm4gVm5vZGUoXCJcIiwgYXR0cnMua2V5LCBhdHRycywgY2hpbGRyZW4pXG4vLyB9XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgYXR0cnMgPSBhcmd1bWVudHNbdGhpc10sIHN0YXJ0ID0gdGhpcyArIDEsIGNoaWxkcmVuXG5cblx0aWYgKGF0dHJzID09IG51bGwpIHtcblx0XHRhdHRycyA9IHt9XG5cdH0gZWxzZSBpZiAodHlwZW9mIGF0dHJzICE9PSBcIm9iamVjdFwiIHx8IGF0dHJzLnRhZyAhPSBudWxsIHx8IEFycmF5LmlzQXJyYXkoYXR0cnMpKSB7XG5cdFx0YXR0cnMgPSB7fVxuXHRcdHN0YXJ0ID0gdGhpc1xuXHR9XG5cblx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IHN0YXJ0ICsgMSkge1xuXHRcdGNoaWxkcmVuID0gYXJndW1lbnRzW3N0YXJ0XVxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIGNoaWxkcmVuID0gW2NoaWxkcmVuXVxuXHR9IGVsc2Uge1xuXHRcdGNoaWxkcmVuID0gW11cblx0XHR3aGlsZSAoc3RhcnQgPCBhcmd1bWVudHMubGVuZ3RoKSBjaGlsZHJlbi5wdXNoKGFyZ3VtZW50c1tzdGFydCsrXSlcblx0fVxuXG5cdHJldHVybiBWbm9kZShcIlwiLCBhdHRycy5rZXksIGF0dHJzLCBjaGlsZHJlbilcbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkd2luZG93KSB7XG5cdHZhciAkZG9jID0gJHdpbmRvdyAmJiAkd2luZG93LmRvY3VtZW50XG5cdHZhciBjdXJyZW50UmVkcmF3XG5cblx0dmFyIG5hbWVTcGFjZSA9IHtcblx0XHRzdmc6IFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIixcblx0XHRtYXRoOiBcImh0dHA6Ly93d3cudzMub3JnLzE5OTgvTWF0aC9NYXRoTUxcIlxuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0TmFtZVNwYWNlKHZub2RlKSB7XG5cdFx0cmV0dXJuIHZub2RlLmF0dHJzICYmIHZub2RlLmF0dHJzLnhtbG5zIHx8IG5hbWVTcGFjZVt2bm9kZS50YWddXG5cdH1cblxuXHQvL3Nhbml0eSBjaGVjayB0byBkaXNjb3VyYWdlIHBlb3BsZSBmcm9tIGRvaW5nIGB2bm9kZS5zdGF0ZSA9IC4uLmBcblx0ZnVuY3Rpb24gY2hlY2tTdGF0ZSh2bm9kZSwgb3JpZ2luYWwpIHtcblx0XHRpZiAodm5vZGUuc3RhdGUgIT09IG9yaWdpbmFsKSB0aHJvdyBuZXcgRXJyb3IoXCJgdm5vZGUuc3RhdGVgIG11c3Qgbm90IGJlIG1vZGlmaWVkXCIpXG5cdH1cblxuXHQvL05vdGU6IHRoZSBob29rIGlzIHBhc3NlZCBhcyB0aGUgYHRoaXNgIGFyZ3VtZW50IHRvIGFsbG93IHByb3h5aW5nIHRoZVxuXHQvL2FyZ3VtZW50cyB3aXRob3V0IHJlcXVpcmluZyBhIGZ1bGwgYXJyYXkgYWxsb2NhdGlvbiB0byBkbyBzby4gSXQgYWxzb1xuXHQvL3Rha2VzIGFkdmFudGFnZSBvZiB0aGUgZmFjdCB0aGUgY3VycmVudCBgdm5vZGVgIGlzIHRoZSBmaXJzdCBhcmd1bWVudCBpblxuXHQvL2FsbCBsaWZlY3ljbGUgbWV0aG9kcy5cblx0ZnVuY3Rpb24gY2FsbEhvb2sodm5vZGUpIHtcblx0XHR2YXIgb3JpZ2luYWwgPSB2bm9kZS5zdGF0ZVxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5hcHBseShvcmlnaW5hbCwgYXJndW1lbnRzKVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjaGVja1N0YXRlKHZub2RlLCBvcmlnaW5hbClcblx0XHR9XG5cdH1cblxuXHQvLyBJRTExIChhdCBsZWFzdCkgdGhyb3dzIGFuIFVuc3BlY2lmaWVkRXJyb3Igd2hlbiBhY2Nlc3NpbmcgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCB3aGVuXG5cdC8vIGluc2lkZSBhbiBpZnJhbWUuIENhdGNoIGFuZCBzd2FsbG93IHRoaXMgZXJyb3IsIGFuZCBoZWF2eS1oYW5kaWRseSByZXR1cm4gbnVsbC5cblx0ZnVuY3Rpb24gYWN0aXZlRWxlbWVudCgpIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuICRkb2MuYWN0aXZlRWxlbWVudFxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBudWxsXG5cdFx0fVxuXHR9XG5cdC8vY3JlYXRlXG5cdGZ1bmN0aW9uIGNyZWF0ZU5vZGVzKHBhcmVudCwgdm5vZGVzLCBzdGFydCwgZW5kLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKSB7XG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcblx0XHRcdHZhciB2bm9kZSA9IHZub2Rlc1tpXVxuXHRcdFx0aWYgKHZub2RlICE9IG51bGwpIHtcblx0XHRcdFx0Y3JlYXRlTm9kZShwYXJlbnQsIHZub2RlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVOb2RlKHBhcmVudCwgdm5vZGUsIGhvb2tzLCBucywgbmV4dFNpYmxpbmcpIHtcblx0XHR2YXIgdGFnID0gdm5vZGUudGFnXG5cdFx0aWYgKHR5cGVvZiB0YWcgPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdHZub2RlLnN0YXRlID0ge31cblx0XHRcdGlmICh2bm9kZS5hdHRycyAhPSBudWxsKSBpbml0TGlmZWN5Y2xlKHZub2RlLmF0dHJzLCB2bm9kZSwgaG9va3MpXG5cdFx0XHRzd2l0Y2ggKHRhZykge1xuXHRcdFx0XHRjYXNlIFwiI1wiOiBjcmVhdGVUZXh0KHBhcmVudCwgdm5vZGUsIG5leHRTaWJsaW5nKTsgYnJlYWtcblx0XHRcdFx0Y2FzZSBcIjxcIjogY3JlYXRlSFRNTChwYXJlbnQsIHZub2RlLCBucywgbmV4dFNpYmxpbmcpOyBicmVha1xuXHRcdFx0XHRjYXNlIFwiW1wiOiBjcmVhdGVGcmFnbWVudChwYXJlbnQsIHZub2RlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKTsgYnJlYWtcblx0XHRcdFx0ZGVmYXVsdDogY3JlYXRlRWxlbWVudChwYXJlbnQsIHZub2RlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIGNyZWF0ZUNvbXBvbmVudChwYXJlbnQsIHZub2RlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKVxuXHR9XG5cdGZ1bmN0aW9uIGNyZWF0ZVRleHQocGFyZW50LCB2bm9kZSwgbmV4dFNpYmxpbmcpIHtcblx0XHR2bm9kZS5kb20gPSAkZG9jLmNyZWF0ZVRleHROb2RlKHZub2RlLmNoaWxkcmVuKVxuXHRcdGluc2VydE5vZGUocGFyZW50LCB2bm9kZS5kb20sIG5leHRTaWJsaW5nKVxuXHR9XG5cdHZhciBwb3NzaWJsZVBhcmVudHMgPSB7Y2FwdGlvbjogXCJ0YWJsZVwiLCB0aGVhZDogXCJ0YWJsZVwiLCB0Ym9keTogXCJ0YWJsZVwiLCB0Zm9vdDogXCJ0YWJsZVwiLCB0cjogXCJ0Ym9keVwiLCB0aDogXCJ0clwiLCB0ZDogXCJ0clwiLCBjb2xncm91cDogXCJ0YWJsZVwiLCBjb2w6IFwiY29sZ3JvdXBcIn1cblx0ZnVuY3Rpb24gY3JlYXRlSFRNTChwYXJlbnQsIHZub2RlLCBucywgbmV4dFNpYmxpbmcpIHtcblx0XHR2YXIgbWF0Y2ggPSB2bm9kZS5jaGlsZHJlbi5tYXRjaCgvXlxccyo/PChcXHcrKS9pbSkgfHwgW11cblx0XHQvLyBub3QgdXNpbmcgdGhlIHByb3BlciBwYXJlbnQgbWFrZXMgdGhlIGNoaWxkIGVsZW1lbnQocykgdmFuaXNoLlxuXHRcdC8vICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRcdC8vICAgICBkaXYuaW5uZXJIVE1MID0gXCI8dGQ+aTwvdGQ+PHRkPmo8L3RkPlwiXG5cdFx0Ly8gICAgIGNvbnNvbGUubG9nKGRpdi5pbm5lckhUTUwpXG5cdFx0Ly8gLS0+IFwiaWpcIiwgbm8gPHRkPiBpbiBzaWdodC5cblx0XHR2YXIgdGVtcCA9ICRkb2MuY3JlYXRlRWxlbWVudChwb3NzaWJsZVBhcmVudHNbbWF0Y2hbMV1dIHx8IFwiZGl2XCIpXG5cdFx0aWYgKG5zID09PSBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIpIHtcblx0XHRcdHRlbXAuaW5uZXJIVE1MID0gXCI8c3ZnIHhtbG5zPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCI+XCIgKyB2bm9kZS5jaGlsZHJlbiArIFwiPC9zdmc+XCJcblx0XHRcdHRlbXAgPSB0ZW1wLmZpcnN0Q2hpbGRcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcC5pbm5lckhUTUwgPSB2bm9kZS5jaGlsZHJlblxuXHRcdH1cblx0XHR2bm9kZS5kb20gPSB0ZW1wLmZpcnN0Q2hpbGRcblx0XHR2bm9kZS5kb21TaXplID0gdGVtcC5jaGlsZE5vZGVzLmxlbmd0aFxuXHRcdC8vIENhcHR1cmUgbm9kZXMgdG8gcmVtb3ZlLCBzbyB3ZSBkb24ndCBjb25mdXNlIHRoZW0uXG5cdFx0dm5vZGUuaW5zdGFuY2UgPSBbXVxuXHRcdHZhciBmcmFnbWVudCA9ICRkb2MuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG5cdFx0dmFyIGNoaWxkXG5cdFx0d2hpbGUgKGNoaWxkID0gdGVtcC5maXJzdENoaWxkKSB7XG5cdFx0XHR2bm9kZS5pbnN0YW5jZS5wdXNoKGNoaWxkKVxuXHRcdFx0ZnJhZ21lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpXG5cdFx0fVxuXHRcdGluc2VydE5vZGUocGFyZW50LCBmcmFnbWVudCwgbmV4dFNpYmxpbmcpXG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlRnJhZ21lbnQocGFyZW50LCB2bm9kZSwgaG9va3MsIG5zLCBuZXh0U2libGluZykge1xuXHRcdHZhciBmcmFnbWVudCA9ICRkb2MuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG5cdFx0aWYgKHZub2RlLmNoaWxkcmVuICE9IG51bGwpIHtcblx0XHRcdHZhciBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cdFx0XHRjcmVhdGVOb2RlcyhmcmFnbWVudCwgY2hpbGRyZW4sIDAsIGNoaWxkcmVuLmxlbmd0aCwgaG9va3MsIG51bGwsIG5zKVxuXHRcdH1cblx0XHR2bm9kZS5kb20gPSBmcmFnbWVudC5maXJzdENoaWxkXG5cdFx0dm5vZGUuZG9tU2l6ZSA9IGZyYWdtZW50LmNoaWxkTm9kZXMubGVuZ3RoXG5cdFx0aW5zZXJ0Tm9kZShwYXJlbnQsIGZyYWdtZW50LCBuZXh0U2libGluZylcblx0fVxuXHRmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHBhcmVudCwgdm5vZGUsIGhvb2tzLCBucywgbmV4dFNpYmxpbmcpIHtcblx0XHR2YXIgdGFnID0gdm5vZGUudGFnXG5cdFx0dmFyIGF0dHJzID0gdm5vZGUuYXR0cnNcblx0XHR2YXIgaXMgPSBhdHRycyAmJiBhdHRycy5pc1xuXG5cdFx0bnMgPSBnZXROYW1lU3BhY2Uodm5vZGUpIHx8IG5zXG5cblx0XHR2YXIgZWxlbWVudCA9IG5zID9cblx0XHRcdGlzID8gJGRvYy5jcmVhdGVFbGVtZW50TlMobnMsIHRhZywge2lzOiBpc30pIDogJGRvYy5jcmVhdGVFbGVtZW50TlMobnMsIHRhZykgOlxuXHRcdFx0aXMgPyAkZG9jLmNyZWF0ZUVsZW1lbnQodGFnLCB7aXM6IGlzfSkgOiAkZG9jLmNyZWF0ZUVsZW1lbnQodGFnKVxuXHRcdHZub2RlLmRvbSA9IGVsZW1lbnRcblxuXHRcdGlmIChhdHRycyAhPSBudWxsKSB7XG5cdFx0XHRzZXRBdHRycyh2bm9kZSwgYXR0cnMsIG5zKVxuXHRcdH1cblxuXHRcdGluc2VydE5vZGUocGFyZW50LCBlbGVtZW50LCBuZXh0U2libGluZylcblxuXHRcdGlmICghbWF5YmVTZXRDb250ZW50RWRpdGFibGUodm5vZGUpKSB7XG5cdFx0XHRpZiAodm5vZGUudGV4dCAhPSBudWxsKSB7XG5cdFx0XHRcdGlmICh2bm9kZS50ZXh0ICE9PSBcIlwiKSBlbGVtZW50LnRleHRDb250ZW50ID0gdm5vZGUudGV4dFxuXHRcdFx0XHRlbHNlIHZub2RlLmNoaWxkcmVuID0gW1Zub2RlKFwiI1wiLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdm5vZGUudGV4dCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXVxuXHRcdFx0fVxuXHRcdFx0aWYgKHZub2RlLmNoaWxkcmVuICE9IG51bGwpIHtcblx0XHRcdFx0dmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblx0XHRcdFx0Y3JlYXRlTm9kZXMoZWxlbWVudCwgY2hpbGRyZW4sIDAsIGNoaWxkcmVuLmxlbmd0aCwgaG9va3MsIG51bGwsIG5zKVxuXHRcdFx0XHRpZiAodm5vZGUudGFnID09PSBcInNlbGVjdFwiICYmIGF0dHJzICE9IG51bGwpIHNldExhdGVTZWxlY3RBdHRycyh2bm9kZSwgYXR0cnMpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGluaXRDb21wb25lbnQodm5vZGUsIGhvb2tzKSB7XG5cdFx0dmFyIHNlbnRpbmVsXG5cdFx0aWYgKHR5cGVvZiB2bm9kZS50YWcudmlldyA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR2bm9kZS5zdGF0ZSA9IE9iamVjdC5jcmVhdGUodm5vZGUudGFnKVxuXHRcdFx0c2VudGluZWwgPSB2bm9kZS5zdGF0ZS52aWV3XG5cdFx0XHRpZiAoc2VudGluZWwuJCRyZWVudHJhbnRMb2NrJCQgIT0gbnVsbCkgcmV0dXJuXG5cdFx0XHRzZW50aW5lbC4kJHJlZW50cmFudExvY2skJCA9IHRydWVcblx0XHR9IGVsc2Uge1xuXHRcdFx0dm5vZGUuc3RhdGUgPSB2b2lkIDBcblx0XHRcdHNlbnRpbmVsID0gdm5vZGUudGFnXG5cdFx0XHRpZiAoc2VudGluZWwuJCRyZWVudHJhbnRMb2NrJCQgIT0gbnVsbCkgcmV0dXJuXG5cdFx0XHRzZW50aW5lbC4kJHJlZW50cmFudExvY2skJCA9IHRydWVcblx0XHRcdHZub2RlLnN0YXRlID0gKHZub2RlLnRhZy5wcm90b3R5cGUgIT0gbnVsbCAmJiB0eXBlb2Ygdm5vZGUudGFnLnByb3RvdHlwZS52aWV3ID09PSBcImZ1bmN0aW9uXCIpID8gbmV3IHZub2RlLnRhZyh2bm9kZSkgOiB2bm9kZS50YWcodm5vZGUpXG5cdFx0fVxuXHRcdGluaXRMaWZlY3ljbGUodm5vZGUuc3RhdGUsIHZub2RlLCBob29rcylcblx0XHRpZiAodm5vZGUuYXR0cnMgIT0gbnVsbCkgaW5pdExpZmVjeWNsZSh2bm9kZS5hdHRycywgdm5vZGUsIGhvb2tzKVxuXHRcdHZub2RlLmluc3RhbmNlID0gVm5vZGUubm9ybWFsaXplKGNhbGxIb29rLmNhbGwodm5vZGUuc3RhdGUudmlldywgdm5vZGUpKVxuXHRcdGlmICh2bm9kZS5pbnN0YW5jZSA9PT0gdm5vZGUpIHRocm93IEVycm9yKFwiQSB2aWV3IGNhbm5vdCByZXR1cm4gdGhlIHZub2RlIGl0IHJlY2VpdmVkIGFzIGFyZ3VtZW50XCIpXG5cdFx0c2VudGluZWwuJCRyZWVudHJhbnRMb2NrJCQgPSBudWxsXG5cdH1cblx0ZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KHBhcmVudCwgdm5vZGUsIGhvb2tzLCBucywgbmV4dFNpYmxpbmcpIHtcblx0XHRpbml0Q29tcG9uZW50KHZub2RlLCBob29rcylcblx0XHRpZiAodm5vZGUuaW5zdGFuY2UgIT0gbnVsbCkge1xuXHRcdFx0Y3JlYXRlTm9kZShwYXJlbnQsIHZub2RlLmluc3RhbmNlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKVxuXHRcdFx0dm5vZGUuZG9tID0gdm5vZGUuaW5zdGFuY2UuZG9tXG5cdFx0XHR2bm9kZS5kb21TaXplID0gdm5vZGUuZG9tICE9IG51bGwgPyB2bm9kZS5pbnN0YW5jZS5kb21TaXplIDogMFxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHZub2RlLmRvbVNpemUgPSAwXG5cdFx0fVxuXHR9XG5cblx0Ly91cGRhdGVcblx0LyoqXG5cdCAqIEBwYXJhbSB7RWxlbWVudHxGcmFnbWVudH0gcGFyZW50IC0gdGhlIHBhcmVudCBlbGVtZW50XG5cdCAqIEBwYXJhbSB7Vm5vZGVbXSB8IG51bGx9IG9sZCAtIHRoZSBsaXN0IG9mIHZub2RlcyBvZiB0aGUgbGFzdCBgcmVuZGVyKClgIGNhbGwgZm9yXG5cdCAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMgcGFydCBvZiB0aGUgdHJlZVxuXHQgKiBAcGFyYW0ge1Zub2RlW10gfCBudWxsfSB2bm9kZXMgLSBhcyBhYm92ZSwgYnV0IGZvciB0aGUgY3VycmVudCBgcmVuZGVyKClgIGNhbGwuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb25bXX0gaG9va3MgLSBhbiBhY2N1bXVsYXRvciBvZiBwb3N0LXJlbmRlciBob29rcyAob25jcmVhdGUvb251cGRhdGUpXG5cdCAqIEBwYXJhbSB7RWxlbWVudCB8IG51bGx9IG5leHRTaWJsaW5nIC0gdGhlIG5leHQgRE9NIG5vZGUgaWYgd2UncmUgZGVhbGluZyB3aXRoIGFcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFnbWVudCB0aGF0IGlzIG5vdCB0aGUgbGFzdCBpdGVtIGluIGl0c1xuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFxuXHQgKiBAcGFyYW0geydzdmcnIHwgJ21hdGgnIHwgU3RyaW5nIHwgbnVsbH0gbnMpIC0gdGhlIGN1cnJlbnQgWE1MIG5hbWVzcGFjZSwgaWYgYW55XG5cdCAqIEByZXR1cm5zIHZvaWRcblx0ICovXG5cdC8vIFRoaXMgZnVuY3Rpb24gZGlmZnMgYW5kIHBhdGNoZXMgbGlzdHMgb2Ygdm5vZGVzLCBib3RoIGtleWVkIGFuZCB1bmtleWVkLlxuXHQvL1xuXHQvLyBXZSB3aWxsOlxuXHQvL1xuXHQvLyAxLiBkZXNjcmliZSBpdHMgZ2VuZXJhbCBzdHJ1Y3R1cmVcblx0Ly8gMi4gZm9jdXMgb24gdGhlIGRpZmYgYWxnb3JpdGhtIG9wdGltaXphdGlvbnNcblx0Ly8gMy4gZGlzY3VzcyBET00gbm9kZSBvcGVyYXRpb25zLlxuXG5cdC8vICMjIE92ZXJ2aWV3OlxuXHQvL1xuXHQvLyBUaGUgdXBkYXRlTm9kZXMoKSBmdW5jdGlvbjpcblx0Ly8gLSBkZWFscyB3aXRoIHRyaXZpYWwgY2FzZXNcblx0Ly8gLSBkZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGxpc3RzIGFyZSBrZXllZCBvciB1bmtleWVkIGJhc2VkIG9uIHRoZSBmaXJzdCBub24tbnVsbCBub2RlXG5cdC8vICAgb2YgZWFjaCBsaXN0LlxuXHQvLyAtIGRpZmZzIHRoZW0gYW5kIHBhdGNoZXMgdGhlIERPTSBpZiBuZWVkZWQgKHRoYXQncyB0aGUgYnJ1bnQgb2YgdGhlIGNvZGUpXG5cdC8vIC0gbWFuYWdlcyB0aGUgbGVmdG92ZXJzOiBhZnRlciBkaWZmaW5nLCBhcmUgdGhlcmU6XG5cdC8vICAgLSBvbGQgbm9kZXMgbGVmdCB0byByZW1vdmU/XG5cdC8vIFx0IC0gbmV3IG5vZGVzIHRvIGluc2VydD9cblx0Ly8gXHQgZGVhbCB3aXRoIHRoZW0hXG5cdC8vXG5cdC8vIFRoZSBsaXN0cyBhcmUgb25seSBpdGVyYXRlZCBvdmVyIG9uY2UsIHdpdGggYW4gZXhjZXB0aW9uIGZvciB0aGUgbm9kZXMgaW4gYG9sZGAgdGhhdFxuXHQvLyBhcmUgdmlzaXRlZCBpbiB0aGUgZm91cnRoIHBhcnQgb2YgdGhlIGRpZmYgYW5kIGluIHRoZSBgcmVtb3ZlTm9kZXNgIGxvb3AuXG5cblx0Ly8gIyMgRGlmZmluZ1xuXHQvL1xuXHQvLyBSZWFkaW5nIGh0dHBzOi8vZ2l0aHViLmNvbS9sb2NhbHZvaWQvaXZpL2Jsb2IvZGRjMDlkMDZhYmFlZjQ1MjQ4ZTYxMzNmNzA0MGQwMGQzYzZiZTg1My9wYWNrYWdlcy9pdmkvc3JjL3Zkb20vaW1wbGVtZW50YXRpb24udHMjTDYxNy1MODM3XG5cdC8vIG1heSBiZSBnb29kIGZvciBjb250ZXh0IG9uIGxvbmdlc3QgaW5jcmVhc2luZyBzdWJzZXF1ZW5jZS1iYXNlZCBsb2dpYyBmb3IgbW92aW5nIG5vZGVzLlxuXHQvL1xuXHQvLyBJbiBvcmRlciB0byBkaWZmIGtleWVkIGxpc3RzLCBvbmUgaGFzIHRvXG5cdC8vXG5cdC8vIDEpIG1hdGNoIG5vZGVzIGluIGJvdGggbGlzdHMsIHBlciBrZXksIGFuZCB1cGRhdGUgdGhlbSBhY2NvcmRpbmdseVxuXHQvLyAyKSBjcmVhdGUgdGhlIG5vZGVzIHByZXNlbnQgaW4gdGhlIG5ldyBsaXN0LCBidXQgYWJzZW50IGluIHRoZSBvbGQgb25lXG5cdC8vIDMpIHJlbW92ZSB0aGUgbm9kZXMgcHJlc2VudCBpbiB0aGUgb2xkIGxpc3QsIGJ1dCBhYnNlbnQgaW4gdGhlIG5ldyBvbmVcblx0Ly8gNCkgZmlndXJlIG91dCB3aGF0IG5vZGVzIGluIDEpIHRvIG1vdmUgaW4gb3JkZXIgdG8gbWluaW1pemUgdGhlIERPTSBvcGVyYXRpb25zLlxuXHQvL1xuXHQvLyBUbyBhY2hpZXZlIDEpIG9uZSBjYW4gY3JlYXRlIGEgZGljdGlvbmFyeSBvZiBrZXlzID0+IGluZGV4IChmb3IgdGhlIG9sZCBsaXN0KSwgdGhlbiBpdGVyYXRlXG5cdC8vIG92ZXIgdGhlIG5ldyBsaXN0IGFuZCBmb3IgZWFjaCBuZXcgdm5vZGUsIGZpbmQgdGhlIGNvcnJlc3BvbmRpbmcgdm5vZGUgaW4gdGhlIG9sZCBsaXN0IHVzaW5nXG5cdC8vIHRoZSBtYXAuXG5cdC8vIDIpIGlzIGFjaGlldmVkIGluIHRoZSBzYW1lIHN0ZXA6IGlmIGEgbmV3IG5vZGUgaGFzIG5vIGNvcnJlc3BvbmRpbmcgZW50cnkgaW4gdGhlIG1hcCwgaXQgaXMgbmV3XG5cdC8vIGFuZCBtdXN0IGJlIGNyZWF0ZWQuXG5cdC8vIEZvciB0aGUgcmVtb3ZhbHMsIHdlIGFjdHVhbGx5IHJlbW92ZSB0aGUgbm9kZXMgdGhhdCBoYXZlIGJlZW4gdXBkYXRlZCBmcm9tIHRoZSBvbGQgbGlzdC5cblx0Ly8gVGhlIG5vZGVzIHRoYXQgcmVtYWluIGluIHRoYXQgbGlzdCBhZnRlciAxKSBhbmQgMikgaGF2ZSBiZWVuIHBlcmZvcm1lZCBjYW4gYmUgc2FmZWx5IHJlbW92ZWQuXG5cdC8vIFRoZSBmb3VydGggc3RlcCBpcyBhIGJpdCBtb3JlIGNvbXBsZXggYW5kIHJlbGllcyBvbiB0aGUgbG9uZ2VzdCBpbmNyZWFzaW5nIHN1YnNlcXVlbmNlIChMSVMpXG5cdC8vIGFsZ29yaXRobS5cblx0Ly9cblx0Ly8gdGhlIGxvbmdlc3QgaW5jcmVhc2luZyBzdWJzZXF1ZW5jZSBpcyB0aGUgbGlzdCBvZiBub2RlcyB0aGF0IGNhbiByZW1haW4gaW4gcGxhY2UuIEltYWdpbmUgZ29pbmdcblx0Ly8gZnJvbSBgMSwyLDMsNCw1YCB0byBgNCw1LDEsMiwzYCB3aGVyZSB0aGUgbnVtYmVycyBhcmUgbm90IG5lY2Vzc2FyaWx5IHRoZSBrZXlzLCBidXQgdGhlIGluZGljZXNcblx0Ly8gY29ycmVzcG9uZGluZyB0byB0aGUga2V5ZWQgbm9kZXMgaW4gdGhlIG9sZCBsaXN0IChrZXllZCBub2RlcyBgZSxkLGMsYixhYCA9PiBgYixhLGUsZCxjYCB3b3VsZFxuXHQvLyAgbWF0Y2ggdGhlIGFib3ZlIGxpc3RzLCBmb3IgZXhhbXBsZSkuXG5cdC8vXG5cdC8vIEluIHRoZXJlIGFyZSB0d28gaW5jcmVhc2luZyBzdWJzZXF1ZW5jZXM6IGA0LDVgIGFuZCBgMSwyLDNgLCB0aGUgbGF0dGVyIGJlaW5nIHRoZSBsb25nZXN0LiBXZVxuXHQvLyBjYW4gdXBkYXRlIHRob3NlIG5vZGVzIHdpdGhvdXQgbW92aW5nIHRoZW0sIGFuZCBvbmx5IGNhbGwgYGluc2VydE5vZGVgIG9uIGA0YCBhbmQgYDVgLlxuXHQvL1xuXHQvLyBAbG9jYWx2b2lkIGFkYXB0ZWQgdGhlIGFsZ28gdG8gYWxzbyBzdXBwb3J0IG5vZGUgZGVsZXRpb25zIGFuZCBpbnNlcnRpb25zICh0aGUgYGxpc2AgaXMgYWN0dWFsbHlcblx0Ly8gdGhlIGxvbmdlc3QgaW5jcmVhc2luZyBzdWJzZXF1ZW5jZSAqb2Ygb2xkIG5vZGVzIHN0aWxsIHByZXNlbnQgaW4gdGhlIG5ldyBsaXN0KikuXG5cdC8vXG5cdC8vIEl0IGlzIGEgZ2VuZXJhbCBhbGdvcml0aG0gdGhhdCBpcyBmaXJlcHJvb2YgaW4gYWxsIGNpcmN1bXN0YW5jZXMsIGJ1dCBpdCByZXF1aXJlcyB0aGUgYWxsb2NhdGlvblxuXHQvLyBhbmQgdGhlIGNvbnN0cnVjdGlvbiBvZiBhIGBrZXkgPT4gb2xkSW5kZXhgIG1hcCwgYW5kIHRocmVlIGFycmF5cyAob25lIHdpdGggYG5ld0luZGV4ID0+IG9sZEluZGV4YCxcblx0Ly8gdGhlIGBMSVNgIGFuZCBhIHRlbXBvcmFyeSBvbmUgdG8gY3JlYXRlIHRoZSBMSVMpLlxuXHQvL1xuXHQvLyBTbyB3ZSBjaGVhdCB3aGVyZSB3ZSBjYW46IGlmIHRoZSB0YWlscyBvZiB0aGUgbGlzdHMgYXJlIGlkZW50aWNhbCwgdGhleSBhcmUgZ3VhcmFudGVlZCB0byBiZSBwYXJ0IG9mXG5cdC8vIHRoZSBMSVMgYW5kIGNhbiBiZSB1cGRhdGVkIHdpdGhvdXQgbW92aW5nIHRoZW0uXG5cdC8vXG5cdC8vIElmIHR3byBub2RlcyBhcmUgc3dhcHBlZCwgdGhleSBhcmUgZ3VhcmFudGVlZCBub3QgdG8gYmUgcGFydCBvZiB0aGUgTElTLCBhbmQgbXVzdCBiZSBtb3ZlZCAod2l0aFxuXHQvLyB0aGUgZXhjZXB0aW9uIG9mIHRoZSBsYXN0IG5vZGUgaWYgdGhlIGxpc3QgaXMgZnVsbHkgcmV2ZXJzZWQpLlxuXHQvL1xuXHQvLyAjIyBGaW5kaW5nIHRoZSBuZXh0IHNpYmxpbmcuXG5cdC8vXG5cdC8vIGB1cGRhdGVOb2RlKClgIGFuZCBgY3JlYXRlTm9kZSgpYCBleHBlY3QgYSBuZXh0U2libGluZyBwYXJhbWV0ZXIgdG8gcGVyZm9ybSBET00gb3BlcmF0aW9ucy5cblx0Ly8gV2hlbiB0aGUgbGlzdCBpcyBiZWluZyB0cmF2ZXJzZWQgdG9wLWRvd24sIGF0IGFueSBpbmRleCwgdGhlIERPTSBub2RlcyB1cCB0byB0aGUgcHJldmlvdXNcblx0Ly8gdm5vZGUgcmVmbGVjdCB0aGUgY29udGVudCBvZiB0aGUgbmV3IGxpc3QsIHdoZXJlYXMgdGhlIHJlc3Qgb2YgdGhlIERPTSBub2RlcyByZWZsZWN0IHRoZSBvbGRcblx0Ly8gbGlzdC4gVGhlIG5leHQgc2libGluZyBtdXN0IGJlIGxvb2tlZCBmb3IgaW4gdGhlIG9sZCBsaXN0IHVzaW5nIGBnZXROZXh0U2libGluZyguLi4gb2xkU3RhcnQgKyAxIC4uLilgLlxuXHQvL1xuXHQvLyBJbiB0aGUgb3RoZXIgc2NlbmFyaW9zIChzd2FwcywgdXB3YXJkcyB0cmF2ZXJzYWwsIG1hcC1iYXNlZCBkaWZmKSxcblx0Ly8gdGhlIG5ldyB2bm9kZXMgbGlzdCBpcyB0cmF2ZXJzZWQgdXB3YXJkcy4gVGhlIERPTSBub2RlcyBhdCB0aGUgYm90dG9tIG9mIHRoZSBsaXN0IHJlZmxlY3QgdGhlXG5cdC8vIGJvdHRvbSBwYXJ0IG9mIHRoZSBuZXcgdm5vZGVzIGxpc3QsIGFuZCB3ZSBjYW4gdXNlIHRoZSBgdi5kb21gICB2YWx1ZSBvZiB0aGUgcHJldmlvdXMgbm9kZVxuXHQvLyBhcyB0aGUgbmV4dCBzaWJsaW5nIChjYWNoZWQgaW4gdGhlIGBuZXh0U2libGluZ2AgdmFyaWFibGUpLlxuXG5cblx0Ly8gIyMgRE9NIG5vZGUgbW92ZXNcblx0Ly9cblx0Ly8gSW4gbW9zdCBzY2VuYXJpb3MgYHVwZGF0ZU5vZGUoKWAgYW5kIGBjcmVhdGVOb2RlKClgIHBlcmZvcm0gdGhlIERPTSBvcGVyYXRpb25zLiBIb3dldmVyLFxuXHQvLyB0aGlzIGlzIG5vdCB0aGUgY2FzZSBpZiB0aGUgbm9kZSBtb3ZlZCAoc2Vjb25kIGFuZCBmb3VydGggcGFydCBvZiB0aGUgZGlmZiBhbGdvKS4gV2UgbW92ZVxuXHQvLyB0aGUgb2xkIERPTSBub2RlcyBiZWZvcmUgdXBkYXRlTm9kZSBydW5zIGJlY2F1c2UgaXQgZW5hYmxlcyB1cyB0byB1c2UgdGhlIGNhY2hlZCBgbmV4dFNpYmxpbmdgXG5cdC8vIHZhcmlhYmxlIHJhdGhlciB0aGFuIGZldGNoaW5nIGl0IHVzaW5nIGBnZXROZXh0U2libGluZygpYC5cblx0Ly9cblx0Ly8gVGhlIGZvdXJ0aCBwYXJ0IG9mIHRoZSBkaWZmIGN1cnJlbnRseSBpbnNlcnRzIG5vZGVzIHVuY29uZGl0aW9uYWxseSwgbGVhZGluZyB0byBpc3N1ZXNcblx0Ly8gbGlrZSAjMTc5MSBhbmQgIzE5OTkuIFdlIG5lZWQgdG8gYmUgc21hcnRlciBhYm91dCB0aG9zZSBzaXR1YXRpb25zIHdoZXJlIGFkamFzY2VudCBvbGRcblx0Ly8gbm9kZXMgcmVtYWluIHRvZ2V0aGVyIGluIHRoZSBuZXcgbGlzdCBpbiBhIHdheSB0aGF0IGlzbid0IGNvdmVyZWQgYnkgcGFydHMgb25lIGFuZFxuXHQvLyB0aHJlZSBvZiB0aGUgZGlmZiBhbGdvLlxuXG5cdGZ1bmN0aW9uIHVwZGF0ZU5vZGVzKHBhcmVudCwgb2xkLCB2bm9kZXMsIGhvb2tzLCBuZXh0U2libGluZywgbnMpIHtcblx0XHRpZiAob2xkID09PSB2bm9kZXMgfHwgb2xkID09IG51bGwgJiYgdm5vZGVzID09IG51bGwpIHJldHVyblxuXHRcdGVsc2UgaWYgKG9sZCA9PSBudWxsIHx8IG9sZC5sZW5ndGggPT09IDApIGNyZWF0ZU5vZGVzKHBhcmVudCwgdm5vZGVzLCAwLCB2bm9kZXMubGVuZ3RoLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdGVsc2UgaWYgKHZub2RlcyA9PSBudWxsIHx8IHZub2Rlcy5sZW5ndGggPT09IDApIHJlbW92ZU5vZGVzKHBhcmVudCwgb2xkLCAwLCBvbGQubGVuZ3RoKVxuXHRcdGVsc2Uge1xuXHRcdFx0dmFyIGlzT2xkS2V5ZWQgPSBvbGRbMF0gIT0gbnVsbCAmJiBvbGRbMF0ua2V5ICE9IG51bGxcblx0XHRcdHZhciBpc0tleWVkID0gdm5vZGVzWzBdICE9IG51bGwgJiYgdm5vZGVzWzBdLmtleSAhPSBudWxsXG5cdFx0XHR2YXIgc3RhcnQgPSAwLCBvbGRTdGFydCA9IDBcblx0XHRcdGlmICghaXNPbGRLZXllZCkgd2hpbGUgKG9sZFN0YXJ0IDwgb2xkLmxlbmd0aCAmJiBvbGRbb2xkU3RhcnRdID09IG51bGwpIG9sZFN0YXJ0Kytcblx0XHRcdGlmICghaXNLZXllZCkgd2hpbGUgKHN0YXJ0IDwgdm5vZGVzLmxlbmd0aCAmJiB2bm9kZXNbc3RhcnRdID09IG51bGwpIHN0YXJ0Kytcblx0XHRcdGlmIChpc0tleWVkID09PSBudWxsICYmIGlzT2xkS2V5ZWQgPT0gbnVsbCkgcmV0dXJuIC8vIGJvdGggbGlzdHMgYXJlIGZ1bGwgb2YgbnVsbHNcblx0XHRcdGlmIChpc09sZEtleWVkICE9PSBpc0tleWVkKSB7XG5cdFx0XHRcdHJlbW92ZU5vZGVzKHBhcmVudCwgb2xkLCBvbGRTdGFydCwgb2xkLmxlbmd0aClcblx0XHRcdFx0Y3JlYXRlTm9kZXMocGFyZW50LCB2bm9kZXMsIHN0YXJ0LCB2bm9kZXMubGVuZ3RoLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdFx0fSBlbHNlIGlmICghaXNLZXllZCkge1xuXHRcdFx0XHQvLyBEb24ndCBpbmRleCBwYXN0IHRoZSBlbmQgb2YgZWl0aGVyIGxpc3QgKGNhdXNlcyBkZW9wdHMpLlxuXHRcdFx0XHR2YXIgY29tbW9uTGVuZ3RoID0gb2xkLmxlbmd0aCA8IHZub2Rlcy5sZW5ndGggPyBvbGQubGVuZ3RoIDogdm5vZGVzLmxlbmd0aFxuXHRcdFx0XHQvLyBSZXdpbmQgaWYgbmVjZXNzYXJ5IHRvIHRoZSBmaXJzdCBub24tbnVsbCBpbmRleCBvbiBlaXRoZXIgc2lkZS5cblx0XHRcdFx0Ly8gV2UgY291bGQgYWx0ZXJuYXRpdmVseSBlaXRoZXIgZXhwbGljaXRseSBjcmVhdGUgb3IgcmVtb3ZlIG5vZGVzIHdoZW4gYHN0YXJ0ICE9PSBvbGRTdGFydGBcblx0XHRcdFx0Ly8gYnV0IHRoYXQgd291bGQgYmUgb3B0aW1pemluZyBmb3Igc3BhcnNlIGxpc3RzIHdoaWNoIGFyZSBtb3JlIHJhcmUgdGhhbiBkZW5zZSBvbmVzLlxuXHRcdFx0XHRzdGFydCA9IHN0YXJ0IDwgb2xkU3RhcnQgPyBzdGFydCA6IG9sZFN0YXJ0XG5cdFx0XHRcdGZvciAoOyBzdGFydCA8IGNvbW1vbkxlbmd0aDsgc3RhcnQrKykge1xuXHRcdFx0XHRcdG8gPSBvbGRbc3RhcnRdXG5cdFx0XHRcdFx0diA9IHZub2Rlc1tzdGFydF1cblx0XHRcdFx0XHRpZiAobyA9PT0gdiB8fCBvID09IG51bGwgJiYgdiA9PSBudWxsKSBjb250aW51ZVxuXHRcdFx0XHRcdGVsc2UgaWYgKG8gPT0gbnVsbCkgY3JlYXRlTm9kZShwYXJlbnQsIHYsIGhvb2tzLCBucywgZ2V0TmV4dFNpYmxpbmcob2xkLCBzdGFydCArIDEsIG5leHRTaWJsaW5nKSlcblx0XHRcdFx0XHRlbHNlIGlmICh2ID09IG51bGwpIHJlbW92ZU5vZGUocGFyZW50LCBvKVxuXHRcdFx0XHRcdGVsc2UgdXBkYXRlTm9kZShwYXJlbnQsIG8sIHYsIGhvb2tzLCBnZXROZXh0U2libGluZyhvbGQsIHN0YXJ0ICsgMSwgbmV4dFNpYmxpbmcpLCBucylcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAob2xkLmxlbmd0aCA+IGNvbW1vbkxlbmd0aCkgcmVtb3ZlTm9kZXMocGFyZW50LCBvbGQsIHN0YXJ0LCBvbGQubGVuZ3RoKVxuXHRcdFx0XHRpZiAodm5vZGVzLmxlbmd0aCA+IGNvbW1vbkxlbmd0aCkgY3JlYXRlTm9kZXMocGFyZW50LCB2bm9kZXMsIHN0YXJ0LCB2bm9kZXMubGVuZ3RoLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8ga2V5ZWQgZGlmZlxuXHRcdFx0XHR2YXIgb2xkRW5kID0gb2xkLmxlbmd0aCAtIDEsIGVuZCA9IHZub2Rlcy5sZW5ndGggLSAxLCBtYXAsIG8sIHYsIG9lLCB2ZSwgdG9wU2libGluZ1xuXG5cdFx0XHRcdC8vIGJvdHRvbS11cFxuXHRcdFx0XHR3aGlsZSAob2xkRW5kID49IG9sZFN0YXJ0ICYmIGVuZCA+PSBzdGFydCkge1xuXHRcdFx0XHRcdG9lID0gb2xkW29sZEVuZF1cblx0XHRcdFx0XHR2ZSA9IHZub2Rlc1tlbmRdXG5cdFx0XHRcdFx0aWYgKG9lLmtleSAhPT0gdmUua2V5KSBicmVha1xuXHRcdFx0XHRcdGlmIChvZSAhPT0gdmUpIHVwZGF0ZU5vZGUocGFyZW50LCBvZSwgdmUsIGhvb2tzLCBuZXh0U2libGluZywgbnMpXG5cdFx0XHRcdFx0aWYgKHZlLmRvbSAhPSBudWxsKSBuZXh0U2libGluZyA9IHZlLmRvbVxuXHRcdFx0XHRcdG9sZEVuZC0tLCBlbmQtLVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIHRvcC1kb3duXG5cdFx0XHRcdHdoaWxlIChvbGRFbmQgPj0gb2xkU3RhcnQgJiYgZW5kID49IHN0YXJ0KSB7XG5cdFx0XHRcdFx0byA9IG9sZFtvbGRTdGFydF1cblx0XHRcdFx0XHR2ID0gdm5vZGVzW3N0YXJ0XVxuXHRcdFx0XHRcdGlmIChvLmtleSAhPT0gdi5rZXkpIGJyZWFrXG5cdFx0XHRcdFx0b2xkU3RhcnQrKywgc3RhcnQrK1xuXHRcdFx0XHRcdGlmIChvICE9PSB2KSB1cGRhdGVOb2RlKHBhcmVudCwgbywgdiwgaG9va3MsIGdldE5leHRTaWJsaW5nKG9sZCwgb2xkU3RhcnQsIG5leHRTaWJsaW5nKSwgbnMpXG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gc3dhcHMgYW5kIGxpc3QgcmV2ZXJzYWxzXG5cdFx0XHRcdHdoaWxlIChvbGRFbmQgPj0gb2xkU3RhcnQgJiYgZW5kID49IHN0YXJ0KSB7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0ID09PSBlbmQpIGJyZWFrXG5cdFx0XHRcdFx0aWYgKG8ua2V5ICE9PSB2ZS5rZXkgfHwgb2Uua2V5ICE9PSB2LmtleSkgYnJlYWtcblx0XHRcdFx0XHR0b3BTaWJsaW5nID0gZ2V0TmV4dFNpYmxpbmcob2xkLCBvbGRTdGFydCwgbmV4dFNpYmxpbmcpXG5cdFx0XHRcdFx0bW92ZU5vZGVzKHBhcmVudCwgb2UsIHRvcFNpYmxpbmcpXG5cdFx0XHRcdFx0aWYgKG9lICE9PSB2KSB1cGRhdGVOb2RlKHBhcmVudCwgb2UsIHYsIGhvb2tzLCB0b3BTaWJsaW5nLCBucylcblx0XHRcdFx0XHRpZiAoKytzdGFydCA8PSAtLWVuZCkgbW92ZU5vZGVzKHBhcmVudCwgbywgbmV4dFNpYmxpbmcpXG5cdFx0XHRcdFx0aWYgKG8gIT09IHZlKSB1cGRhdGVOb2RlKHBhcmVudCwgbywgdmUsIGhvb2tzLCBuZXh0U2libGluZywgbnMpXG5cdFx0XHRcdFx0aWYgKHZlLmRvbSAhPSBudWxsKSBuZXh0U2libGluZyA9IHZlLmRvbVxuXHRcdFx0XHRcdG9sZFN0YXJ0Kys7IG9sZEVuZC0tXG5cdFx0XHRcdFx0b2UgPSBvbGRbb2xkRW5kXVxuXHRcdFx0XHRcdHZlID0gdm5vZGVzW2VuZF1cblx0XHRcdFx0XHRvID0gb2xkW29sZFN0YXJ0XVxuXHRcdFx0XHRcdHYgPSB2bm9kZXNbc3RhcnRdXG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gYm90dG9tIHVwIG9uY2UgYWdhaW5cblx0XHRcdFx0d2hpbGUgKG9sZEVuZCA+PSBvbGRTdGFydCAmJiBlbmQgPj0gc3RhcnQpIHtcblx0XHRcdFx0XHRpZiAob2Uua2V5ICE9PSB2ZS5rZXkpIGJyZWFrXG5cdFx0XHRcdFx0aWYgKG9lICE9PSB2ZSkgdXBkYXRlTm9kZShwYXJlbnQsIG9lLCB2ZSwgaG9va3MsIG5leHRTaWJsaW5nLCBucylcblx0XHRcdFx0XHRpZiAodmUuZG9tICE9IG51bGwpIG5leHRTaWJsaW5nID0gdmUuZG9tXG5cdFx0XHRcdFx0b2xkRW5kLS0sIGVuZC0tXG5cdFx0XHRcdFx0b2UgPSBvbGRbb2xkRW5kXVxuXHRcdFx0XHRcdHZlID0gdm5vZGVzW2VuZF1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoc3RhcnQgPiBlbmQpIHJlbW92ZU5vZGVzKHBhcmVudCwgb2xkLCBvbGRTdGFydCwgb2xkRW5kICsgMSlcblx0XHRcdFx0ZWxzZSBpZiAob2xkU3RhcnQgPiBvbGRFbmQpIGNyZWF0ZU5vZGVzKHBhcmVudCwgdm5vZGVzLCBzdGFydCwgZW5kICsgMSwgaG9va3MsIG5leHRTaWJsaW5nLCBucylcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Ly8gaW5zcGlyZWQgYnkgaXZpIGh0dHBzOi8vZ2l0aHViLmNvbS9pdmlqcy9pdmkvIGJ5IEJvcmlzIEthdWxcblx0XHRcdFx0XHR2YXIgb3JpZ2luYWxOZXh0U2libGluZyA9IG5leHRTaWJsaW5nLCB2bm9kZXNMZW5ndGggPSBlbmQgLSBzdGFydCArIDEsIG9sZEluZGljZXMgPSBuZXcgQXJyYXkodm5vZGVzTGVuZ3RoKSwgbGk9MCwgaT0wLCBwb3MgPSAyMTQ3NDgzNjQ3LCBtYXRjaGVkID0gMCwgbWFwLCBsaXNJbmRpY2VzXG5cdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHZub2Rlc0xlbmd0aDsgaSsrKSBvbGRJbmRpY2VzW2ldID0gLTFcblx0XHRcdFx0XHRmb3IgKGkgPSBlbmQ7IGkgPj0gc3RhcnQ7IGktLSkge1xuXHRcdFx0XHRcdFx0aWYgKG1hcCA9PSBudWxsKSBtYXAgPSBnZXRLZXlNYXAob2xkLCBvbGRTdGFydCwgb2xkRW5kICsgMSlcblx0XHRcdFx0XHRcdHZlID0gdm5vZGVzW2ldXG5cdFx0XHRcdFx0XHR2YXIgb2xkSW5kZXggPSBtYXBbdmUua2V5XVxuXHRcdFx0XHRcdFx0aWYgKG9sZEluZGV4ICE9IG51bGwpIHtcblx0XHRcdFx0XHRcdFx0cG9zID0gKG9sZEluZGV4IDwgcG9zKSA/IG9sZEluZGV4IDogLTEgLy8gYmVjb21lcyAtMSBpZiBub2RlcyB3ZXJlIHJlLW9yZGVyZWRcblx0XHRcdFx0XHRcdFx0b2xkSW5kaWNlc1tpLXN0YXJ0XSA9IG9sZEluZGV4XG5cdFx0XHRcdFx0XHRcdG9lID0gb2xkW29sZEluZGV4XVxuXHRcdFx0XHRcdFx0XHRvbGRbb2xkSW5kZXhdID0gbnVsbFxuXHRcdFx0XHRcdFx0XHRpZiAob2UgIT09IHZlKSB1cGRhdGVOb2RlKHBhcmVudCwgb2UsIHZlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdFx0XHRcdFx0XHRpZiAodmUuZG9tICE9IG51bGwpIG5leHRTaWJsaW5nID0gdmUuZG9tXG5cdFx0XHRcdFx0XHRcdG1hdGNoZWQrK1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXh0U2libGluZyA9IG9yaWdpbmFsTmV4dFNpYmxpbmdcblx0XHRcdFx0XHRpZiAobWF0Y2hlZCAhPT0gb2xkRW5kIC0gb2xkU3RhcnQgKyAxKSByZW1vdmVOb2RlcyhwYXJlbnQsIG9sZCwgb2xkU3RhcnQsIG9sZEVuZCArIDEpXG5cdFx0XHRcdFx0aWYgKG1hdGNoZWQgPT09IDApIGNyZWF0ZU5vZGVzKHBhcmVudCwgdm5vZGVzLCBzdGFydCwgZW5kICsgMSwgaG9va3MsIG5leHRTaWJsaW5nLCBucylcblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGlmIChwb3MgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdC8vIHRoZSBpbmRpY2VzIG9mIHRoZSBpbmRpY2VzIG9mIHRoZSBpdGVtcyB0aGF0IGFyZSBwYXJ0IG9mIHRoZVxuXHRcdFx0XHRcdFx0XHQvLyBsb25nZXN0IGluY3JlYXNpbmcgc3Vic2VxdWVuY2UgaW4gdGhlIG9sZEluZGljZXMgbGlzdFxuXHRcdFx0XHRcdFx0XHRsaXNJbmRpY2VzID0gbWFrZUxpc0luZGljZXMob2xkSW5kaWNlcylcblx0XHRcdFx0XHRcdFx0bGkgPSBsaXNJbmRpY2VzLmxlbmd0aCAtIDFcblx0XHRcdFx0XHRcdFx0Zm9yIChpID0gZW5kOyBpID49IHN0YXJ0OyBpLS0pIHtcblx0XHRcdFx0XHRcdFx0XHR2ID0gdm5vZGVzW2ldXG5cdFx0XHRcdFx0XHRcdFx0aWYgKG9sZEluZGljZXNbaS1zdGFydF0gPT09IC0xKSBjcmVhdGVOb2RlKHBhcmVudCwgdiwgaG9va3MsIG5zLCBuZXh0U2libGluZylcblx0XHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChsaXNJbmRpY2VzW2xpXSA9PT0gaSAtIHN0YXJ0KSBsaS0tXG5cdFx0XHRcdFx0XHRcdFx0XHRlbHNlIG1vdmVOb2RlcyhwYXJlbnQsIHYsIG5leHRTaWJsaW5nKVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRpZiAodi5kb20gIT0gbnVsbCkgbmV4dFNpYmxpbmcgPSB2bm9kZXNbaV0uZG9tXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGZvciAoaSA9IGVuZDsgaSA+PSBzdGFydDsgaS0tKSB7XG5cdFx0XHRcdFx0XHRcdFx0diA9IHZub2Rlc1tpXVxuXHRcdFx0XHRcdFx0XHRcdGlmIChvbGRJbmRpY2VzW2ktc3RhcnRdID09PSAtMSkgY3JlYXRlTm9kZShwYXJlbnQsIHYsIGhvb2tzLCBucywgbmV4dFNpYmxpbmcpXG5cdFx0XHRcdFx0XHRcdFx0aWYgKHYuZG9tICE9IG51bGwpIG5leHRTaWJsaW5nID0gdm5vZGVzW2ldLmRvbVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZU5vZGUocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKSB7XG5cdFx0dmFyIG9sZFRhZyA9IG9sZC50YWcsIHRhZyA9IHZub2RlLnRhZ1xuXHRcdGlmIChvbGRUYWcgPT09IHRhZykge1xuXHRcdFx0dm5vZGUuc3RhdGUgPSBvbGQuc3RhdGVcblx0XHRcdHZub2RlLmV2ZW50cyA9IG9sZC5ldmVudHNcblx0XHRcdGlmIChzaG91bGROb3RVcGRhdGUodm5vZGUsIG9sZCkpIHJldHVyblxuXHRcdFx0aWYgKHR5cGVvZiBvbGRUYWcgPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdFx0aWYgKHZub2RlLmF0dHJzICE9IG51bGwpIHtcblx0XHRcdFx0XHR1cGRhdGVMaWZlY3ljbGUodm5vZGUuYXR0cnMsIHZub2RlLCBob29rcylcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKG9sZFRhZykge1xuXHRcdFx0XHRcdGNhc2UgXCIjXCI6IHVwZGF0ZVRleHQob2xkLCB2bm9kZSk7IGJyZWFrXG5cdFx0XHRcdFx0Y2FzZSBcIjxcIjogdXBkYXRlSFRNTChwYXJlbnQsIG9sZCwgdm5vZGUsIG5zLCBuZXh0U2libGluZyk7IGJyZWFrXG5cdFx0XHRcdFx0Y2FzZSBcIltcIjogdXBkYXRlRnJhZ21lbnQocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKTsgYnJlYWtcblx0XHRcdFx0XHRkZWZhdWx0OiB1cGRhdGVFbGVtZW50KG9sZCwgdm5vZGUsIGhvb2tzLCBucylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB1cGRhdGVDb21wb25lbnQocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJlbW92ZU5vZGUocGFyZW50LCBvbGQpXG5cdFx0XHRjcmVhdGVOb2RlKHBhcmVudCwgdm5vZGUsIGhvb2tzLCBucywgbmV4dFNpYmxpbmcpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHVwZGF0ZVRleHQob2xkLCB2bm9kZSkge1xuXHRcdGlmIChvbGQuY2hpbGRyZW4udG9TdHJpbmcoKSAhPT0gdm5vZGUuY2hpbGRyZW4udG9TdHJpbmcoKSkge1xuXHRcdFx0b2xkLmRvbS5ub2RlVmFsdWUgPSB2bm9kZS5jaGlsZHJlblxuXHRcdH1cblx0XHR2bm9kZS5kb20gPSBvbGQuZG9tXG5cdH1cblx0ZnVuY3Rpb24gdXBkYXRlSFRNTChwYXJlbnQsIG9sZCwgdm5vZGUsIG5zLCBuZXh0U2libGluZykge1xuXHRcdGlmIChvbGQuY2hpbGRyZW4gIT09IHZub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRyZW1vdmVIVE1MKHBhcmVudCwgb2xkKVxuXHRcdFx0Y3JlYXRlSFRNTChwYXJlbnQsIHZub2RlLCBucywgbmV4dFNpYmxpbmcpXG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dm5vZGUuZG9tID0gb2xkLmRvbVxuXHRcdFx0dm5vZGUuZG9tU2l6ZSA9IG9sZC5kb21TaXplXG5cdFx0XHR2bm9kZS5pbnN0YW5jZSA9IG9sZC5pbnN0YW5jZVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVGcmFnbWVudChwYXJlbnQsIG9sZCwgdm5vZGUsIGhvb2tzLCBuZXh0U2libGluZywgbnMpIHtcblx0XHR1cGRhdGVOb2RlcyhwYXJlbnQsIG9sZC5jaGlsZHJlbiwgdm5vZGUuY2hpbGRyZW4sIGhvb2tzLCBuZXh0U2libGluZywgbnMpXG5cdFx0dmFyIGRvbVNpemUgPSAwLCBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cdFx0dm5vZGUuZG9tID0gbnVsbFxuXHRcdGlmIChjaGlsZHJlbiAhPSBudWxsKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG5cdFx0XHRcdGlmIChjaGlsZCAhPSBudWxsICYmIGNoaWxkLmRvbSAhPSBudWxsKSB7XG5cdFx0XHRcdFx0aWYgKHZub2RlLmRvbSA9PSBudWxsKSB2bm9kZS5kb20gPSBjaGlsZC5kb21cblx0XHRcdFx0XHRkb21TaXplICs9IGNoaWxkLmRvbVNpemUgfHwgMVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZG9tU2l6ZSAhPT0gMSkgdm5vZGUuZG9tU2l6ZSA9IGRvbVNpemVcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gdXBkYXRlRWxlbWVudChvbGQsIHZub2RlLCBob29rcywgbnMpIHtcblx0XHR2YXIgZWxlbWVudCA9IHZub2RlLmRvbSA9IG9sZC5kb21cblx0XHRucyA9IGdldE5hbWVTcGFjZSh2bm9kZSkgfHwgbnNcblxuXHRcdGlmICh2bm9kZS50YWcgPT09IFwidGV4dGFyZWFcIikge1xuXHRcdFx0aWYgKHZub2RlLmF0dHJzID09IG51bGwpIHZub2RlLmF0dHJzID0ge31cblx0XHRcdGlmICh2bm9kZS50ZXh0ICE9IG51bGwpIHtcblx0XHRcdFx0dm5vZGUuYXR0cnMudmFsdWUgPSB2bm9kZS50ZXh0IC8vRklYTUUgaGFuZGxlIG11bHRpcGxlIGNoaWxkcmVuXG5cdFx0XHRcdHZub2RlLnRleHQgPSB1bmRlZmluZWRcblx0XHRcdH1cblx0XHR9XG5cdFx0dXBkYXRlQXR0cnModm5vZGUsIG9sZC5hdHRycywgdm5vZGUuYXR0cnMsIG5zKVxuXHRcdGlmICghbWF5YmVTZXRDb250ZW50RWRpdGFibGUodm5vZGUpKSB7XG5cdFx0XHRpZiAob2xkLnRleHQgIT0gbnVsbCAmJiB2bm9kZS50ZXh0ICE9IG51bGwgJiYgdm5vZGUudGV4dCAhPT0gXCJcIikge1xuXHRcdFx0XHRpZiAob2xkLnRleHQudG9TdHJpbmcoKSAhPT0gdm5vZGUudGV4dC50b1N0cmluZygpKSBvbGQuZG9tLmZpcnN0Q2hpbGQubm9kZVZhbHVlID0gdm5vZGUudGV4dFxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmIChvbGQudGV4dCAhPSBudWxsKSBvbGQuY2hpbGRyZW4gPSBbVm5vZGUoXCIjXCIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvbGQudGV4dCwgdW5kZWZpbmVkLCBvbGQuZG9tLmZpcnN0Q2hpbGQpXVxuXHRcdFx0XHRpZiAodm5vZGUudGV4dCAhPSBudWxsKSB2bm9kZS5jaGlsZHJlbiA9IFtWbm9kZShcIiNcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHZub2RlLnRleHQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKV1cblx0XHRcdFx0dXBkYXRlTm9kZXMoZWxlbWVudCwgb2xkLmNoaWxkcmVuLCB2bm9kZS5jaGlsZHJlbiwgaG9va3MsIG51bGwsIG5zKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVDb21wb25lbnQocGFyZW50LCBvbGQsIHZub2RlLCBob29rcywgbmV4dFNpYmxpbmcsIG5zKSB7XG5cdFx0dm5vZGUuaW5zdGFuY2UgPSBWbm9kZS5ub3JtYWxpemUoY2FsbEhvb2suY2FsbCh2bm9kZS5zdGF0ZS52aWV3LCB2bm9kZSkpXG5cdFx0aWYgKHZub2RlLmluc3RhbmNlID09PSB2bm9kZSkgdGhyb3cgRXJyb3IoXCJBIHZpZXcgY2Fubm90IHJldHVybiB0aGUgdm5vZGUgaXQgcmVjZWl2ZWQgYXMgYXJndW1lbnRcIilcblx0XHR1cGRhdGVMaWZlY3ljbGUodm5vZGUuc3RhdGUsIHZub2RlLCBob29rcylcblx0XHRpZiAodm5vZGUuYXR0cnMgIT0gbnVsbCkgdXBkYXRlTGlmZWN5Y2xlKHZub2RlLmF0dHJzLCB2bm9kZSwgaG9va3MpXG5cdFx0aWYgKHZub2RlLmluc3RhbmNlICE9IG51bGwpIHtcblx0XHRcdGlmIChvbGQuaW5zdGFuY2UgPT0gbnVsbCkgY3JlYXRlTm9kZShwYXJlbnQsIHZub2RlLmluc3RhbmNlLCBob29rcywgbnMsIG5leHRTaWJsaW5nKVxuXHRcdFx0ZWxzZSB1cGRhdGVOb2RlKHBhcmVudCwgb2xkLmluc3RhbmNlLCB2bm9kZS5pbnN0YW5jZSwgaG9va3MsIG5leHRTaWJsaW5nLCBucylcblx0XHRcdHZub2RlLmRvbSA9IHZub2RlLmluc3RhbmNlLmRvbVxuXHRcdFx0dm5vZGUuZG9tU2l6ZSA9IHZub2RlLmluc3RhbmNlLmRvbVNpemVcblx0XHR9XG5cdFx0ZWxzZSBpZiAob2xkLmluc3RhbmNlICE9IG51bGwpIHtcblx0XHRcdHJlbW92ZU5vZGUocGFyZW50LCBvbGQuaW5zdGFuY2UpXG5cdFx0XHR2bm9kZS5kb20gPSB1bmRlZmluZWRcblx0XHRcdHZub2RlLmRvbVNpemUgPSAwXG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dm5vZGUuZG9tID0gb2xkLmRvbVxuXHRcdFx0dm5vZGUuZG9tU2l6ZSA9IG9sZC5kb21TaXplXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIGdldEtleU1hcCh2bm9kZXMsIHN0YXJ0LCBlbmQpIHtcblx0XHR2YXIgbWFwID0gT2JqZWN0LmNyZWF0ZShudWxsKVxuXHRcdGZvciAoOyBzdGFydCA8IGVuZDsgc3RhcnQrKykge1xuXHRcdFx0dmFyIHZub2RlID0gdm5vZGVzW3N0YXJ0XVxuXHRcdFx0aWYgKHZub2RlICE9IG51bGwpIHtcblx0XHRcdFx0dmFyIGtleSA9IHZub2RlLmtleVxuXHRcdFx0XHRpZiAoa2V5ICE9IG51bGwpIG1hcFtrZXldID0gc3RhcnRcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG1hcFxuXHR9XG5cdC8vIExpZnRlZCBmcm9tIGl2aSBodHRwczovL2dpdGh1Yi5jb20vaXZpanMvaXZpL1xuXHQvLyB0YWtlcyBhIGxpc3Qgb2YgdW5pcXVlIG51bWJlcnMgKC0xIGlzIHNwZWNpYWwgYW5kIGNhblxuXHQvLyBvY2N1ciBtdWx0aXBsZSB0aW1lcykgYW5kIHJldHVybnMgYW4gYXJyYXkgd2l0aCB0aGUgaW5kaWNlc1xuXHQvLyBvZiB0aGUgaXRlbXMgdGhhdCBhcmUgcGFydCBvZiB0aGUgbG9uZ2VzdCBpbmNyZWFzaW5nXG5cdC8vIHN1YnNlcXVlY2Vcblx0dmFyIGxpc1RlbXAgPSBbXVxuXHRmdW5jdGlvbiBtYWtlTGlzSW5kaWNlcyhhKSB7XG5cdFx0dmFyIHJlc3VsdCA9IFswXVxuXHRcdHZhciB1ID0gMCwgdiA9IDAsIGkgPSAwXG5cdFx0dmFyIGlsID0gbGlzVGVtcC5sZW5ndGggPSBhLmxlbmd0aFxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgaWw7IGkrKykgbGlzVGVtcFtpXSA9IGFbaV1cblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGlsOyArK2kpIHtcblx0XHRcdGlmIChhW2ldID09PSAtMSkgY29udGludWVcblx0XHRcdHZhciBqID0gcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXVxuXHRcdFx0aWYgKGFbal0gPCBhW2ldKSB7XG5cdFx0XHRcdGxpc1RlbXBbaV0gPSBqXG5cdFx0XHRcdHJlc3VsdC5wdXNoKGkpXG5cdFx0XHRcdGNvbnRpbnVlXG5cdFx0XHR9XG5cdFx0XHR1ID0gMFxuXHRcdFx0diA9IHJlc3VsdC5sZW5ndGggLSAxXG5cdFx0XHR3aGlsZSAodSA8IHYpIHtcblx0XHRcdFx0Ly8gRmFzdCBpbnRlZ2VyIGF2ZXJhZ2Ugd2l0aG91dCBvdmVyZmxvdy5cblx0XHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWJpdHdpc2Vcblx0XHRcdFx0dmFyIGMgPSAodSA+Pj4gMSkgKyAodiA+Pj4gMSkgKyAodSAmIHYgJiAxKVxuXHRcdFx0XHRpZiAoYVtyZXN1bHRbY11dIDwgYVtpXSkge1xuXHRcdFx0XHRcdHUgPSBjICsgMVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHYgPSBjXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChhW2ldIDwgYVtyZXN1bHRbdV1dKSB7XG5cdFx0XHRcdGlmICh1ID4gMCkgbGlzVGVtcFtpXSA9IHJlc3VsdFt1IC0gMV1cblx0XHRcdFx0cmVzdWx0W3VdID0gaVxuXHRcdFx0fVxuXHRcdH1cblx0XHR1ID0gcmVzdWx0Lmxlbmd0aFxuXHRcdHYgPSByZXN1bHRbdSAtIDFdXG5cdFx0d2hpbGUgKHUtLSA+IDApIHtcblx0XHRcdHJlc3VsdFt1XSA9IHZcblx0XHRcdHYgPSBsaXNUZW1wW3ZdXG5cdFx0fVxuXHRcdGxpc1RlbXAubGVuZ3RoID0gMFxuXHRcdHJldHVybiByZXN1bHRcblx0fVxuXG5cdGZ1bmN0aW9uIGdldE5leHRTaWJsaW5nKHZub2RlcywgaSwgbmV4dFNpYmxpbmcpIHtcblx0XHRmb3IgKDsgaSA8IHZub2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHZub2Rlc1tpXSAhPSBudWxsICYmIHZub2Rlc1tpXS5kb20gIT0gbnVsbCkgcmV0dXJuIHZub2Rlc1tpXS5kb21cblx0XHR9XG5cdFx0cmV0dXJuIG5leHRTaWJsaW5nXG5cdH1cblxuXHQvLyBUaGlzIGNvdmVycyBhIHJlYWxseSBzcGVjaWZpYyBlZGdlIGNhc2U6XG5cdC8vIC0gUGFyZW50IG5vZGUgaXMga2V5ZWQgYW5kIGNvbnRhaW5zIGNoaWxkXG5cdC8vIC0gQ2hpbGQgaXMgcmVtb3ZlZCwgcmV0dXJucyB1bnJlc29sdmVkIHByb21pc2UgaW4gYG9uYmVmb3JlcmVtb3ZlYFxuXHQvLyAtIFBhcmVudCBub2RlIGlzIG1vdmVkIGluIGtleWVkIGRpZmZcblx0Ly8gLSBSZW1haW5pbmcgY2hpbGRyZW4gc3RpbGwgbmVlZCBtb3ZlZCBhcHByb3ByaWF0ZWx5XG5cdC8vXG5cdC8vIElkZWFsbHksIEknZCB0cmFjayByZW1vdmVkIG5vZGVzIGFzIHdlbGwsIGJ1dCB0aGF0IGludHJvZHVjZXMgYSBsb3QgbW9yZVxuXHQvLyBjb21wbGV4aXR5IGFuZCBJJ20gbm90IGV4YWN0bHkgaW50ZXJlc3RlZCBpbiBkb2luZyB0aGF0LlxuXHRmdW5jdGlvbiBtb3ZlTm9kZXMocGFyZW50LCB2bm9kZSwgbmV4dFNpYmxpbmcpIHtcblx0XHR2YXIgZnJhZyA9ICRkb2MuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG5cdFx0bW92ZUNoaWxkVG9GcmFnKHBhcmVudCwgZnJhZywgdm5vZGUpXG5cdFx0aW5zZXJ0Tm9kZShwYXJlbnQsIGZyYWcsIG5leHRTaWJsaW5nKVxuXHR9XG5cdGZ1bmN0aW9uIG1vdmVDaGlsZFRvRnJhZyhwYXJlbnQsIGZyYWcsIHZub2RlKSB7XG5cdFx0Ly8gRG9kZ2UgdGhlIHJlY3Vyc2lvbiBvdmVyaGVhZCBpbiBhIGZldyBvZiB0aGUgbW9zdCBjb21tb24gY2FzZXMuXG5cdFx0d2hpbGUgKHZub2RlLmRvbSAhPSBudWxsICYmIHZub2RlLmRvbS5wYXJlbnROb2RlID09PSBwYXJlbnQpIHtcblx0XHRcdGlmICh0eXBlb2Ygdm5vZGUudGFnICE9PSBcInN0cmluZ1wiKSB7XG5cdFx0XHRcdHZub2RlID0gdm5vZGUuaW5zdGFuY2Vcblx0XHRcdFx0aWYgKHZub2RlICE9IG51bGwpIGNvbnRpbnVlXG5cdFx0XHR9IGVsc2UgaWYgKHZub2RlLnRhZyA9PT0gXCI8XCIpIHtcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCB2bm9kZS5pbnN0YW5jZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGZyYWcuYXBwZW5kQ2hpbGQodm5vZGUuaW5zdGFuY2VbaV0pXG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAodm5vZGUudGFnICE9PSBcIltcIikge1xuXHRcdFx0XHQvLyBEb24ndCByZWN1cnNlIGZvciB0ZXh0IG5vZGVzICpvciogZWxlbWVudHMsIGp1c3QgZnJhZ21lbnRzXG5cdFx0XHRcdGZyYWcuYXBwZW5kQ2hpbGQodm5vZGUuZG9tKVxuXHRcdFx0fSBlbHNlIGlmICh2bm9kZS5jaGlsZHJlbi5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0dm5vZGUgPSB2bm9kZS5jaGlsZHJlblswXVxuXHRcdFx0XHRpZiAodm5vZGUgIT0gbnVsbCkgY29udGludWVcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHR2YXIgY2hpbGQgPSB2bm9kZS5jaGlsZHJlbltpXVxuXHRcdFx0XHRcdGlmIChjaGlsZCAhPSBudWxsKSBtb3ZlQ2hpbGRUb0ZyYWcocGFyZW50LCBmcmFnLCBjaGlsZClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YnJlYWtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBpbnNlcnROb2RlKHBhcmVudCwgZG9tLCBuZXh0U2libGluZykge1xuXHRcdGlmIChuZXh0U2libGluZyAhPSBudWxsKSBwYXJlbnQuaW5zZXJ0QmVmb3JlKGRvbSwgbmV4dFNpYmxpbmcpXG5cdFx0ZWxzZSBwYXJlbnQuYXBwZW5kQ2hpbGQoZG9tKVxuXHR9XG5cblx0ZnVuY3Rpb24gbWF5YmVTZXRDb250ZW50RWRpdGFibGUodm5vZGUpIHtcblx0XHRpZiAodm5vZGUuYXR0cnMgPT0gbnVsbCB8fCAoXG5cdFx0XHR2bm9kZS5hdHRycy5jb250ZW50ZWRpdGFibGUgPT0gbnVsbCAmJiAvLyBhdHRyaWJ1dGVcblx0XHRcdHZub2RlLmF0dHJzLmNvbnRlbnRFZGl0YWJsZSA9PSBudWxsIC8vIHByb3BlcnR5XG5cdFx0KSkgcmV0dXJuIGZhbHNlXG5cdFx0dmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblx0XHRpZiAoY2hpbGRyZW4gIT0gbnVsbCAmJiBjaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgY2hpbGRyZW5bMF0udGFnID09PSBcIjxcIikge1xuXHRcdFx0dmFyIGNvbnRlbnQgPSBjaGlsZHJlblswXS5jaGlsZHJlblxuXHRcdFx0aWYgKHZub2RlLmRvbS5pbm5lckhUTUwgIT09IGNvbnRlbnQpIHZub2RlLmRvbS5pbm5lckhUTUwgPSBjb250ZW50XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHZub2RlLnRleHQgIT0gbnVsbCB8fCBjaGlsZHJlbiAhPSBudWxsICYmIGNoaWxkcmVuLmxlbmd0aCAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKFwiQ2hpbGQgbm9kZSBvZiBhIGNvbnRlbnRlZGl0YWJsZSBtdXN0IGJlIHRydXN0ZWRcIilcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG5cblx0Ly9yZW1vdmVcblx0ZnVuY3Rpb24gcmVtb3ZlTm9kZXMocGFyZW50LCB2bm9kZXMsIHN0YXJ0LCBlbmQpIHtcblx0XHRmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuXHRcdFx0dmFyIHZub2RlID0gdm5vZGVzW2ldXG5cdFx0XHRpZiAodm5vZGUgIT0gbnVsbCkgcmVtb3ZlTm9kZShwYXJlbnQsIHZub2RlKVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiByZW1vdmVOb2RlKHBhcmVudCwgdm5vZGUpIHtcblx0XHR2YXIgbWFzayA9IDBcblx0XHR2YXIgb3JpZ2luYWwgPSB2bm9kZS5zdGF0ZVxuXHRcdHZhciBzdGF0ZVJlc3VsdCwgYXR0cnNSZXN1bHRcblx0XHRpZiAodHlwZW9mIHZub2RlLnRhZyAhPT0gXCJzdHJpbmdcIiAmJiB0eXBlb2Ygdm5vZGUuc3RhdGUub25iZWZvcmVyZW1vdmUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dmFyIHJlc3VsdCA9IGNhbGxIb29rLmNhbGwodm5vZGUuc3RhdGUub25iZWZvcmVyZW1vdmUsIHZub2RlKVxuXHRcdFx0aWYgKHJlc3VsdCAhPSBudWxsICYmIHR5cGVvZiByZXN1bHQudGhlbiA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdG1hc2sgPSAxXG5cdFx0XHRcdHN0YXRlUmVzdWx0ID0gcmVzdWx0XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh2bm9kZS5hdHRycyAmJiB0eXBlb2Ygdm5vZGUuYXR0cnMub25iZWZvcmVyZW1vdmUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dmFyIHJlc3VsdCA9IGNhbGxIb29rLmNhbGwodm5vZGUuYXR0cnMub25iZWZvcmVyZW1vdmUsIHZub2RlKVxuXHRcdFx0aWYgKHJlc3VsdCAhPSBudWxsICYmIHR5cGVvZiByZXN1bHQudGhlbiA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1iaXR3aXNlXG5cdFx0XHRcdG1hc2sgfD0gMlxuXHRcdFx0XHRhdHRyc1Jlc3VsdCA9IHJlc3VsdFxuXHRcdFx0fVxuXHRcdH1cblx0XHRjaGVja1N0YXRlKHZub2RlLCBvcmlnaW5hbClcblxuXHRcdC8vIElmIHdlIGNhbiwgdHJ5IHRvIGZhc3QtcGF0aCBpdCBhbmQgYXZvaWQgYWxsIHRoZSBvdmVyaGVhZCBvZiBhd2FpdGluZ1xuXHRcdGlmICghbWFzaykge1xuXHRcdFx0b25yZW1vdmUodm5vZGUpXG5cdFx0XHRyZW1vdmVDaGlsZChwYXJlbnQsIHZub2RlKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoc3RhdGVSZXN1bHQgIT0gbnVsbCkge1xuXHRcdFx0XHR2YXIgbmV4dCA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tYml0d2lzZVxuXHRcdFx0XHRcdGlmIChtYXNrICYgMSkgeyBtYXNrICY9IDI7IGlmICghbWFzaykgcmVhbGx5UmVtb3ZlKCkgfVxuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YXRlUmVzdWx0LnRoZW4obmV4dCwgbmV4dClcblx0XHRcdH1cblx0XHRcdGlmIChhdHRyc1Jlc3VsdCAhPSBudWxsKSB7XG5cdFx0XHRcdHZhciBuZXh0ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1iaXR3aXNlXG5cdFx0XHRcdFx0aWYgKG1hc2sgJiAyKSB7IG1hc2sgJj0gMTsgaWYgKCFtYXNrKSByZWFsbHlSZW1vdmUoKSB9XG5cdFx0XHRcdH1cblx0XHRcdFx0YXR0cnNSZXN1bHQudGhlbihuZXh0LCBuZXh0KVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJlYWxseVJlbW92ZSgpIHtcblx0XHRcdGNoZWNrU3RhdGUodm5vZGUsIG9yaWdpbmFsKVxuXHRcdFx0b25yZW1vdmUodm5vZGUpXG5cdFx0XHRyZW1vdmVDaGlsZChwYXJlbnQsIHZub2RlKVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiByZW1vdmVIVE1MKHBhcmVudCwgdm5vZGUpIHtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHZub2RlLmluc3RhbmNlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRwYXJlbnQucmVtb3ZlQ2hpbGQodm5vZGUuaW5zdGFuY2VbaV0pXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHJlbW92ZUNoaWxkKHBhcmVudCwgdm5vZGUpIHtcblx0XHQvLyBEb2RnZSB0aGUgcmVjdXJzaW9uIG92ZXJoZWFkIGluIGEgZmV3IG9mIHRoZSBtb3N0IGNvbW1vbiBjYXNlcy5cblx0XHR3aGlsZSAodm5vZGUuZG9tICE9IG51bGwgJiYgdm5vZGUuZG9tLnBhcmVudE5vZGUgPT09IHBhcmVudCkge1xuXHRcdFx0aWYgKHR5cGVvZiB2bm9kZS50YWcgIT09IFwic3RyaW5nXCIpIHtcblx0XHRcdFx0dm5vZGUgPSB2bm9kZS5pbnN0YW5jZVxuXHRcdFx0XHRpZiAodm5vZGUgIT0gbnVsbCkgY29udGludWVcblx0XHRcdH0gZWxzZSBpZiAodm5vZGUudGFnID09PSBcIjxcIikge1xuXHRcdFx0XHRyZW1vdmVIVE1MKHBhcmVudCwgdm5vZGUpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodm5vZGUudGFnICE9PSBcIltcIikge1xuXHRcdFx0XHRcdHBhcmVudC5yZW1vdmVDaGlsZCh2bm9kZS5kb20pXG5cdFx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHZub2RlLmNoaWxkcmVuKSkgYnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodm5vZGUuY2hpbGRyZW4ubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0dm5vZGUgPSB2bm9kZS5jaGlsZHJlblswXVxuXHRcdFx0XHRcdGlmICh2bm9kZSAhPSBudWxsKSBjb250aW51ZVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdHZhciBjaGlsZCA9IHZub2RlLmNoaWxkcmVuW2ldXG5cdFx0XHRcdFx0XHRpZiAoY2hpbGQgIT0gbnVsbCkgcmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGJyZWFrXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIG9ucmVtb3ZlKHZub2RlKSB7XG5cdFx0aWYgKHR5cGVvZiB2bm9kZS50YWcgIT09IFwic3RyaW5nXCIgJiYgdHlwZW9mIHZub2RlLnN0YXRlLm9ucmVtb3ZlID09PSBcImZ1bmN0aW9uXCIpIGNhbGxIb29rLmNhbGwodm5vZGUuc3RhdGUub25yZW1vdmUsIHZub2RlKVxuXHRcdGlmICh2bm9kZS5hdHRycyAmJiB0eXBlb2Ygdm5vZGUuYXR0cnMub25yZW1vdmUgPT09IFwiZnVuY3Rpb25cIikgY2FsbEhvb2suY2FsbCh2bm9kZS5hdHRycy5vbnJlbW92ZSwgdm5vZGUpXG5cdFx0aWYgKHR5cGVvZiB2bm9kZS50YWcgIT09IFwic3RyaW5nXCIpIHtcblx0XHRcdGlmICh2bm9kZS5pbnN0YW5jZSAhPSBudWxsKSBvbnJlbW92ZSh2bm9kZS5pbnN0YW5jZSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0dmFyIGNoaWxkID0gY2hpbGRyZW5baV1cblx0XHRcdFx0XHRpZiAoY2hpbGQgIT0gbnVsbCkgb25yZW1vdmUoY2hpbGQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvL2F0dHJzXG5cdGZ1bmN0aW9uIHNldEF0dHJzKHZub2RlLCBhdHRycywgbnMpIHtcblx0XHRmb3IgKHZhciBrZXkgaW4gYXR0cnMpIHtcblx0XHRcdHNldEF0dHIodm5vZGUsIGtleSwgbnVsbCwgYXR0cnNba2V5XSwgbnMpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldEF0dHIodm5vZGUsIGtleSwgb2xkLCB2YWx1ZSwgbnMpIHtcblx0XHRpZiAoa2V5ID09PSBcImtleVwiIHx8IGtleSA9PT0gXCJpc1wiIHx8IHZhbHVlID09IG51bGwgfHwgaXNMaWZlY3ljbGVNZXRob2Qoa2V5KSB8fCAob2xkID09PSB2YWx1ZSAmJiAhaXNGb3JtQXR0cmlidXRlKHZub2RlLCBrZXkpKSAmJiB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHJldHVyblxuXHRcdGlmIChrZXlbMF0gPT09IFwib1wiICYmIGtleVsxXSA9PT0gXCJuXCIpIHJldHVybiB1cGRhdGVFdmVudCh2bm9kZSwga2V5LCB2YWx1ZSlcblx0XHRpZiAoa2V5LnNsaWNlKDAsIDYpID09PSBcInhsaW5rOlwiKSB2bm9kZS5kb20uc2V0QXR0cmlidXRlTlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsIGtleS5zbGljZSg2KSwgdmFsdWUpXG5cdFx0ZWxzZSBpZiAoa2V5ID09PSBcInN0eWxlXCIpIHVwZGF0ZVN0eWxlKHZub2RlLmRvbSwgb2xkLCB2YWx1ZSlcblx0XHRlbHNlIGlmIChoYXNQcm9wZXJ0eUtleSh2bm9kZSwga2V5LCBucykpIHtcblx0XHRcdGlmIChrZXkgPT09IFwidmFsdWVcIikge1xuXHRcdFx0XHQvLyBPbmx5IGRvIHRoZSBjb2VyY2lvbiBpZiB3ZSdyZSBhY3R1YWxseSBnb2luZyB0byBjaGVjayB0aGUgdmFsdWUuXG5cdFx0XHRcdC8qIGVzbGludC1kaXNhYmxlIG5vLWltcGxpY2l0LWNvZXJjaW9uICovXG5cdFx0XHRcdC8vc2V0dGluZyBpbnB1dFt2YWx1ZV0gdG8gc2FtZSB2YWx1ZSBieSB0eXBpbmcgb24gZm9jdXNlZCBlbGVtZW50IG1vdmVzIGN1cnNvciB0byBlbmQgaW4gQ2hyb21lXG5cdFx0XHRcdGlmICgodm5vZGUudGFnID09PSBcImlucHV0XCIgfHwgdm5vZGUudGFnID09PSBcInRleHRhcmVhXCIpICYmIHZub2RlLmRvbS52YWx1ZSA9PT0gXCJcIiArIHZhbHVlICYmIHZub2RlLmRvbSA9PT0gYWN0aXZlRWxlbWVudCgpKSByZXR1cm5cblx0XHRcdFx0Ly9zZXR0aW5nIHNlbGVjdFt2YWx1ZV0gdG8gc2FtZSB2YWx1ZSB3aGlsZSBoYXZpbmcgc2VsZWN0IG9wZW4gYmxpbmtzIHNlbGVjdCBkcm9wZG93biBpbiBDaHJvbWVcblx0XHRcdFx0aWYgKHZub2RlLnRhZyA9PT0gXCJzZWxlY3RcIiAmJiBvbGQgIT09IG51bGwgJiYgdm5vZGUuZG9tLnZhbHVlID09PSBcIlwiICsgdmFsdWUpIHJldHVyblxuXHRcdFx0XHQvL3NldHRpbmcgb3B0aW9uW3ZhbHVlXSB0byBzYW1lIHZhbHVlIHdoaWxlIGhhdmluZyBzZWxlY3Qgb3BlbiBibGlua3Mgc2VsZWN0IGRyb3Bkb3duIGluIENocm9tZVxuXHRcdFx0XHRpZiAodm5vZGUudGFnID09PSBcIm9wdGlvblwiICYmIG9sZCAhPT0gbnVsbCAmJiB2bm9kZS5kb20udmFsdWUgPT09IFwiXCIgKyB2YWx1ZSkgcmV0dXJuXG5cdFx0XHRcdC8qIGVzbGludC1lbmFibGUgbm8taW1wbGljaXQtY29lcmNpb24gKi9cblx0XHRcdH1cblx0XHRcdC8vIElmIHlvdSBhc3NpZ24gYW4gaW5wdXQgdHlwZSB0aGF0IGlzIG5vdCBzdXBwb3J0ZWQgYnkgSUUgMTEgd2l0aCBhbiBhc3NpZ25tZW50IGV4cHJlc3Npb24sIGFuIGVycm9yIHdpbGwgb2NjdXIuXG5cdFx0XHRpZiAodm5vZGUudGFnID09PSBcImlucHV0XCIgJiYga2V5ID09PSBcInR5cGVcIikgdm5vZGUuZG9tLnNldEF0dHJpYnV0ZShrZXksIHZhbHVlKVxuXHRcdFx0ZWxzZSB2bm9kZS5kb21ba2V5XSA9IHZhbHVlXG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG5cdFx0XHRcdGlmICh2YWx1ZSkgdm5vZGUuZG9tLnNldEF0dHJpYnV0ZShrZXksIFwiXCIpXG5cdFx0XHRcdGVsc2Ugdm5vZGUuZG9tLnJlbW92ZUF0dHJpYnV0ZShrZXkpXG5cdFx0XHR9XG5cdFx0XHRlbHNlIHZub2RlLmRvbS5zZXRBdHRyaWJ1dGUoa2V5ID09PSBcImNsYXNzTmFtZVwiID8gXCJjbGFzc1wiIDoga2V5LCB2YWx1ZSlcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gcmVtb3ZlQXR0cih2bm9kZSwga2V5LCBvbGQsIG5zKSB7XG5cdFx0aWYgKGtleSA9PT0gXCJrZXlcIiB8fCBrZXkgPT09IFwiaXNcIiB8fCBvbGQgPT0gbnVsbCB8fCBpc0xpZmVjeWNsZU1ldGhvZChrZXkpKSByZXR1cm5cblx0XHRpZiAoa2V5WzBdID09PSBcIm9cIiAmJiBrZXlbMV0gPT09IFwiblwiICYmICFpc0xpZmVjeWNsZU1ldGhvZChrZXkpKSB1cGRhdGVFdmVudCh2bm9kZSwga2V5LCB1bmRlZmluZWQpXG5cdFx0ZWxzZSBpZiAoa2V5ID09PSBcInN0eWxlXCIpIHVwZGF0ZVN0eWxlKHZub2RlLmRvbSwgb2xkLCBudWxsKVxuXHRcdGVsc2UgaWYgKFxuXHRcdFx0aGFzUHJvcGVydHlLZXkodm5vZGUsIGtleSwgbnMpXG5cdFx0XHQmJiBrZXkgIT09IFwiY2xhc3NOYW1lXCJcblx0XHRcdCYmICEoa2V5ID09PSBcInZhbHVlXCIgJiYgKFxuXHRcdFx0XHR2bm9kZS50YWcgPT09IFwib3B0aW9uXCJcblx0XHRcdFx0fHwgdm5vZGUudGFnID09PSBcInNlbGVjdFwiICYmIHZub2RlLmRvbS5zZWxlY3RlZEluZGV4ID09PSAtMSAmJiB2bm9kZS5kb20gPT09IGFjdGl2ZUVsZW1lbnQoKVxuXHRcdFx0KSlcblx0XHRcdCYmICEodm5vZGUudGFnID09PSBcImlucHV0XCIgJiYga2V5ID09PSBcInR5cGVcIilcblx0XHQpIHtcblx0XHRcdHZub2RlLmRvbVtrZXldID0gbnVsbFxuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgbnNMYXN0SW5kZXggPSBrZXkuaW5kZXhPZihcIjpcIilcblx0XHRcdGlmIChuc0xhc3RJbmRleCAhPT0gLTEpIGtleSA9IGtleS5zbGljZShuc0xhc3RJbmRleCArIDEpXG5cdFx0XHRpZiAob2xkICE9PSBmYWxzZSkgdm5vZGUuZG9tLnJlbW92ZUF0dHJpYnV0ZShrZXkgPT09IFwiY2xhc3NOYW1lXCIgPyBcImNsYXNzXCIgOiBrZXkpXG5cdFx0fVxuXHR9XG5cdGZ1bmN0aW9uIHNldExhdGVTZWxlY3RBdHRycyh2bm9kZSwgYXR0cnMpIHtcblx0XHRpZiAoXCJ2YWx1ZVwiIGluIGF0dHJzKSB7XG5cdFx0XHRpZihhdHRycy52YWx1ZSA9PT0gbnVsbCkge1xuXHRcdFx0XHRpZiAodm5vZGUuZG9tLnNlbGVjdGVkSW5kZXggIT09IC0xKSB2bm9kZS5kb20udmFsdWUgPSBudWxsXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2YXIgbm9ybWFsaXplZCA9IFwiXCIgKyBhdHRycy52YWx1ZSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWltcGxpY2l0LWNvZXJjaW9uXG5cdFx0XHRcdGlmICh2bm9kZS5kb20udmFsdWUgIT09IG5vcm1hbGl6ZWQgfHwgdm5vZGUuZG9tLnNlbGVjdGVkSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0dm5vZGUuZG9tLnZhbHVlID0gbm9ybWFsaXplZFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChcInNlbGVjdGVkSW5kZXhcIiBpbiBhdHRycykgc2V0QXR0cih2bm9kZSwgXCJzZWxlY3RlZEluZGV4XCIsIG51bGwsIGF0dHJzLnNlbGVjdGVkSW5kZXgsIHVuZGVmaW5lZClcblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVBdHRycyh2bm9kZSwgb2xkLCBhdHRycywgbnMpIHtcblx0XHRpZiAoYXR0cnMgIT0gbnVsbCkge1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG5cdFx0XHRcdHNldEF0dHIodm5vZGUsIGtleSwgb2xkICYmIG9sZFtrZXldLCBhdHRyc1trZXldLCBucylcblx0XHRcdH1cblx0XHR9XG5cdFx0dmFyIHZhbFxuXHRcdGlmIChvbGQgIT0gbnVsbCkge1xuXHRcdFx0Zm9yICh2YXIga2V5IGluIG9sZCkge1xuXHRcdFx0XHRpZiAoKCh2YWwgPSBvbGRba2V5XSkgIT0gbnVsbCkgJiYgKGF0dHJzID09IG51bGwgfHwgYXR0cnNba2V5XSA9PSBudWxsKSkge1xuXHRcdFx0XHRcdHJlbW92ZUF0dHIodm5vZGUsIGtleSwgdmFsLCBucylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBpc0Zvcm1BdHRyaWJ1dGUodm5vZGUsIGF0dHIpIHtcblx0XHRyZXR1cm4gYXR0ciA9PT0gXCJ2YWx1ZVwiIHx8IGF0dHIgPT09IFwiY2hlY2tlZFwiIHx8IGF0dHIgPT09IFwic2VsZWN0ZWRJbmRleFwiIHx8IGF0dHIgPT09IFwic2VsZWN0ZWRcIiAmJiB2bm9kZS5kb20gPT09IGFjdGl2ZUVsZW1lbnQoKSB8fCB2bm9kZS50YWcgPT09IFwib3B0aW9uXCIgJiYgdm5vZGUuZG9tLnBhcmVudE5vZGUgPT09ICRkb2MuYWN0aXZlRWxlbWVudFxuXHR9XG5cdGZ1bmN0aW9uIGlzTGlmZWN5Y2xlTWV0aG9kKGF0dHIpIHtcblx0XHRyZXR1cm4gYXR0ciA9PT0gXCJvbmluaXRcIiB8fCBhdHRyID09PSBcIm9uY3JlYXRlXCIgfHwgYXR0ciA9PT0gXCJvbnVwZGF0ZVwiIHx8IGF0dHIgPT09IFwib25yZW1vdmVcIiB8fCBhdHRyID09PSBcIm9uYmVmb3JlcmVtb3ZlXCIgfHwgYXR0ciA9PT0gXCJvbmJlZm9yZXVwZGF0ZVwiXG5cdH1cblx0ZnVuY3Rpb24gaGFzUHJvcGVydHlLZXkodm5vZGUsIGtleSwgbnMpIHtcblx0XHQvLyBGaWx0ZXIgb3V0IG5hbWVzcGFjZWQga2V5c1xuXHRcdHJldHVybiBucyA9PT0gdW5kZWZpbmVkICYmIChcblx0XHRcdC8vIElmIGl0J3MgYSBjdXN0b20gZWxlbWVudCwganVzdCBrZWVwIGl0LlxuXHRcdFx0dm5vZGUudGFnLmluZGV4T2YoXCItXCIpID4gLTEgfHwgdm5vZGUuYXR0cnMgIT0gbnVsbCAmJiB2bm9kZS5hdHRycy5pcyB8fFxuXHRcdFx0Ly8gSWYgaXQncyBhIG5vcm1hbCBlbGVtZW50LCBsZXQncyB0cnkgdG8gYXZvaWQgYSBmZXcgYnJvd3NlciBidWdzLlxuXHRcdFx0a2V5ICE9PSBcImhyZWZcIiAmJiBrZXkgIT09IFwibGlzdFwiICYmIGtleSAhPT0gXCJmb3JtXCIgJiYga2V5ICE9PSBcIndpZHRoXCIgJiYga2V5ICE9PSBcImhlaWdodFwiLy8gJiYga2V5ICE9PSBcInR5cGVcIlxuXHRcdFx0Ly8gRGVmZXIgdGhlIHByb3BlcnR5IGNoZWNrIHVudGlsICphZnRlciogd2UgY2hlY2sgZXZlcnl0aGluZy5cblx0XHQpICYmIGtleSBpbiB2bm9kZS5kb21cblx0fVxuXG5cdC8vc3R5bGVcblx0dmFyIHVwcGVyY2FzZVJlZ2V4ID0gL1tBLVpdL2dcblx0ZnVuY3Rpb24gdG9Mb3dlckNhc2UoY2FwaXRhbCkgeyByZXR1cm4gXCItXCIgKyBjYXBpdGFsLnRvTG93ZXJDYXNlKCkgfVxuXHRmdW5jdGlvbiBub3JtYWxpemVLZXkoa2V5KSB7XG5cdFx0cmV0dXJuIGtleVswXSA9PT0gXCItXCIgJiYga2V5WzFdID09PSBcIi1cIiA/IGtleSA6XG5cdFx0XHRrZXkgPT09IFwiY3NzRmxvYXRcIiA/IFwiZmxvYXRcIiA6XG5cdFx0XHRcdGtleS5yZXBsYWNlKHVwcGVyY2FzZVJlZ2V4LCB0b0xvd2VyQ2FzZSlcblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVTdHlsZShlbGVtZW50LCBvbGQsIHN0eWxlKSB7XG5cdFx0aWYgKG9sZCA9PT0gc3R5bGUpIHtcblx0XHRcdC8vIFN0eWxlcyBhcmUgZXF1aXZhbGVudCwgZG8gbm90aGluZy5cblx0XHR9IGVsc2UgaWYgKHN0eWxlID09IG51bGwpIHtcblx0XHRcdC8vIE5ldyBzdHlsZSBpcyBtaXNzaW5nLCBqdXN0IGNsZWFyIGl0LlxuXHRcdFx0ZWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gXCJcIlxuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHN0eWxlICE9PSBcIm9iamVjdFwiKSB7XG5cdFx0XHQvLyBOZXcgc3R5bGUgaXMgYSBzdHJpbmcsIGxldCBlbmdpbmUgZGVhbCB3aXRoIHBhdGNoaW5nLlxuXHRcdFx0ZWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gc3R5bGVcblx0XHR9IGVsc2UgaWYgKG9sZCA9PSBudWxsIHx8IHR5cGVvZiBvbGQgIT09IFwib2JqZWN0XCIpIHtcblx0XHRcdC8vIGBvbGRgIGlzIG1pc3Npbmcgb3IgYSBzdHJpbmcsIGBzdHlsZWAgaXMgYW4gb2JqZWN0LlxuXHRcdFx0ZWxlbWVudC5zdHlsZS5jc3NUZXh0ID0gXCJcIlxuXHRcdFx0Ly8gQWRkIG5ldyBzdHlsZSBwcm9wZXJ0aWVzXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gc3R5bGUpIHtcblx0XHRcdFx0dmFyIHZhbHVlID0gc3R5bGVba2V5XVxuXHRcdFx0XHRpZiAodmFsdWUgIT0gbnVsbCkgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShub3JtYWxpemVLZXkoa2V5KSwgU3RyaW5nKHZhbHVlKSlcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gQm90aCBvbGQgJiBuZXcgYXJlIChkaWZmZXJlbnQpIG9iamVjdHMuXG5cdFx0XHQvLyBVcGRhdGUgc3R5bGUgcHJvcGVydGllcyB0aGF0IGhhdmUgY2hhbmdlZFxuXHRcdFx0Zm9yICh2YXIga2V5IGluIHN0eWxlKSB7XG5cdFx0XHRcdHZhciB2YWx1ZSA9IHN0eWxlW2tleV1cblx0XHRcdFx0aWYgKHZhbHVlICE9IG51bGwgJiYgKHZhbHVlID0gU3RyaW5nKHZhbHVlKSkgIT09IFN0cmluZyhvbGRba2V5XSkpIHtcblx0XHRcdFx0XHRlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KG5vcm1hbGl6ZUtleShrZXkpLCB2YWx1ZSlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gUmVtb3ZlIHN0eWxlIHByb3BlcnRpZXMgdGhhdCBubyBsb25nZXIgZXhpc3Rcblx0XHRcdGZvciAodmFyIGtleSBpbiBvbGQpIHtcblx0XHRcdFx0aWYgKG9sZFtrZXldICE9IG51bGwgJiYgc3R5bGVba2V5XSA9PSBudWxsKSB7XG5cdFx0XHRcdFx0ZWxlbWVudC5zdHlsZS5yZW1vdmVQcm9wZXJ0eShub3JtYWxpemVLZXkoa2V5KSlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIEhlcmUncyBhbiBleHBsYW5hdGlvbiBvZiBob3cgdGhpcyB3b3Jrczpcblx0Ly8gMS4gVGhlIGV2ZW50IG5hbWVzIGFyZSBhbHdheXMgKGJ5IGRlc2lnbikgcHJlZml4ZWQgYnkgYG9uYC5cblx0Ly8gMi4gVGhlIEV2ZW50TGlzdGVuZXIgaW50ZXJmYWNlIGFjY2VwdHMgZWl0aGVyIGEgZnVuY3Rpb24gb3IgYW4gb2JqZWN0XG5cdC8vICAgIHdpdGggYSBgaGFuZGxlRXZlbnRgIG1ldGhvZC5cblx0Ly8gMy4gVGhlIG9iamVjdCBkb2VzIG5vdCBpbmhlcml0IGZyb20gYE9iamVjdC5wcm90b3R5cGVgLCB0byBhdm9pZFxuXHQvLyAgICBhbnkgcG90ZW50aWFsIGludGVyZmVyZW5jZSB3aXRoIHRoYXQgKGUuZy4gc2V0dGVycykuXG5cdC8vIDQuIFRoZSBldmVudCBuYW1lIGlzIHJlbWFwcGVkIHRvIHRoZSBoYW5kbGVyIGJlZm9yZSBjYWxsaW5nIGl0LlxuXHQvLyA1LiBJbiBmdW5jdGlvbi1iYXNlZCBldmVudCBoYW5kbGVycywgYGV2LnRhcmdldCA9PT0gdGhpc2AuIFdlIHJlcGxpY2F0ZVxuXHQvLyAgICB0aGF0IGJlbG93LlxuXHQvLyA2LiBJbiBmdW5jdGlvbi1iYXNlZCBldmVudCBoYW5kbGVycywgYHJldHVybiBmYWxzZWAgcHJldmVudHMgdGhlIGRlZmF1bHRcblx0Ly8gICAgYWN0aW9uIGFuZCBzdG9wcyBldmVudCBwcm9wYWdhdGlvbi4gV2UgcmVwbGljYXRlIHRoYXQgYmVsb3cuXG5cdGZ1bmN0aW9uIEV2ZW50RGljdCgpIHtcblx0XHQvLyBTYXZlIHRoaXMsIHNvIHRoZSBjdXJyZW50IHJlZHJhdyBpcyBjb3JyZWN0bHkgdHJhY2tlZC5cblx0XHR0aGlzLl8gPSBjdXJyZW50UmVkcmF3XG5cdH1cblx0RXZlbnREaWN0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUobnVsbClcblx0RXZlbnREaWN0LnByb3RvdHlwZS5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIChldikge1xuXHRcdHZhciBoYW5kbGVyID0gdGhpc1tcIm9uXCIgKyBldi50eXBlXVxuXHRcdHZhciByZXN1bHRcblx0XHRpZiAodHlwZW9mIGhhbmRsZXIgPT09IFwiZnVuY3Rpb25cIikgcmVzdWx0ID0gaGFuZGxlci5jYWxsKGV2LmN1cnJlbnRUYXJnZXQsIGV2KVxuXHRcdGVsc2UgaWYgKHR5cGVvZiBoYW5kbGVyLmhhbmRsZUV2ZW50ID09PSBcImZ1bmN0aW9uXCIpIGhhbmRsZXIuaGFuZGxlRXZlbnQoZXYpXG5cdFx0aWYgKHRoaXMuXyAmJiBldi5yZWRyYXcgIT09IGZhbHNlKSAoMCwgdGhpcy5fKSgpXG5cdFx0aWYgKHJlc3VsdCA9PT0gZmFsc2UpIHtcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KClcblx0XHRcdGV2LnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0fVxuXHR9XG5cblx0Ly9ldmVudFxuXHRmdW5jdGlvbiB1cGRhdGVFdmVudCh2bm9kZSwga2V5LCB2YWx1ZSkge1xuXHRcdGlmICh2bm9kZS5ldmVudHMgIT0gbnVsbCkge1xuXHRcdFx0aWYgKHZub2RlLmV2ZW50c1trZXldID09PSB2YWx1ZSkgcmV0dXJuXG5cdFx0XHRpZiAodmFsdWUgIT0gbnVsbCAmJiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSkge1xuXHRcdFx0XHRpZiAodm5vZGUuZXZlbnRzW2tleV0gPT0gbnVsbCkgdm5vZGUuZG9tLmFkZEV2ZW50TGlzdGVuZXIoa2V5LnNsaWNlKDIpLCB2bm9kZS5ldmVudHMsIGZhbHNlKVxuXHRcdFx0XHR2bm9kZS5ldmVudHNba2V5XSA9IHZhbHVlXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAodm5vZGUuZXZlbnRzW2tleV0gIT0gbnVsbCkgdm5vZGUuZG9tLnJlbW92ZUV2ZW50TGlzdGVuZXIoa2V5LnNsaWNlKDIpLCB2bm9kZS5ldmVudHMsIGZhbHNlKVxuXHRcdFx0XHR2bm9kZS5ldmVudHNba2V5XSA9IHVuZGVmaW5lZFxuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCAmJiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSkge1xuXHRcdFx0dm5vZGUuZXZlbnRzID0gbmV3IEV2ZW50RGljdCgpXG5cdFx0XHR2bm9kZS5kb20uYWRkRXZlbnRMaXN0ZW5lcihrZXkuc2xpY2UoMiksIHZub2RlLmV2ZW50cywgZmFsc2UpXG5cdFx0XHR2bm9kZS5ldmVudHNba2V5XSA9IHZhbHVlXG5cdFx0fVxuXHR9XG5cblx0Ly9saWZlY3ljbGVcblx0ZnVuY3Rpb24gaW5pdExpZmVjeWNsZShzb3VyY2UsIHZub2RlLCBob29rcykge1xuXHRcdGlmICh0eXBlb2Ygc291cmNlLm9uaW5pdCA9PT0gXCJmdW5jdGlvblwiKSBjYWxsSG9vay5jYWxsKHNvdXJjZS5vbmluaXQsIHZub2RlKVxuXHRcdGlmICh0eXBlb2Ygc291cmNlLm9uY3JlYXRlID09PSBcImZ1bmN0aW9uXCIpIGhvb2tzLnB1c2goY2FsbEhvb2suYmluZChzb3VyY2Uub25jcmVhdGUsIHZub2RlKSlcblx0fVxuXHRmdW5jdGlvbiB1cGRhdGVMaWZlY3ljbGUoc291cmNlLCB2bm9kZSwgaG9va3MpIHtcblx0XHRpZiAodHlwZW9mIHNvdXJjZS5vbnVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiKSBob29rcy5wdXNoKGNhbGxIb29rLmJpbmQoc291cmNlLm9udXBkYXRlLCB2bm9kZSkpXG5cdH1cblx0ZnVuY3Rpb24gc2hvdWxkTm90VXBkYXRlKHZub2RlLCBvbGQpIHtcblx0XHRkbyB7XG5cdFx0XHRpZiAodm5vZGUuYXR0cnMgIT0gbnVsbCAmJiB0eXBlb2Ygdm5vZGUuYXR0cnMub25iZWZvcmV1cGRhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR2YXIgZm9yY2UgPSBjYWxsSG9vay5jYWxsKHZub2RlLmF0dHJzLm9uYmVmb3JldXBkYXRlLCB2bm9kZSwgb2xkKVxuXHRcdFx0XHRpZiAoZm9yY2UgIT09IHVuZGVmaW5lZCAmJiAhZm9yY2UpIGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIHZub2RlLnRhZyAhPT0gXCJzdHJpbmdcIiAmJiB0eXBlb2Ygdm5vZGUuc3RhdGUub25iZWZvcmV1cGRhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR2YXIgZm9yY2UgPSBjYWxsSG9vay5jYWxsKHZub2RlLnN0YXRlLm9uYmVmb3JldXBkYXRlLCB2bm9kZSwgb2xkKVxuXHRcdFx0XHRpZiAoZm9yY2UgIT09IHVuZGVmaW5lZCAmJiAhZm9yY2UpIGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9IHdoaWxlIChmYWxzZSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG5cdFx0dm5vZGUuZG9tID0gb2xkLmRvbVxuXHRcdHZub2RlLmRvbVNpemUgPSBvbGQuZG9tU2l6ZVxuXHRcdHZub2RlLmluc3RhbmNlID0gb2xkLmluc3RhbmNlXG5cdFx0Ly8gT25lIHdvdWxkIHRoaW5rIGhhdmluZyB0aGUgYWN0dWFsIGxhdGVzdCBhdHRyaWJ1dGVzIHdvdWxkIGJlIGlkZWFsLFxuXHRcdC8vIGJ1dCBpdCBkb2Vzbid0IGxldCB1cyBwcm9wZXJseSBkaWZmIGJhc2VkIG9uIG91ciBjdXJyZW50IGludGVybmFsXG5cdFx0Ly8gcmVwcmVzZW50YXRpb24uIFdlIGhhdmUgdG8gc2F2ZSBub3Qgb25seSB0aGUgb2xkIERPTSBpbmZvLCBidXQgYWxzb1xuXHRcdC8vIHRoZSBhdHRyaWJ1dGVzIHVzZWQgdG8gY3JlYXRlIGl0LCBhcyB3ZSBkaWZmICp0aGF0Kiwgbm90IGFnYWluc3QgdGhlXG5cdFx0Ly8gRE9NIGRpcmVjdGx5ICh3aXRoIGEgZmV3IGV4Y2VwdGlvbnMgaW4gYHNldEF0dHJgKS4gQW5kLCBvZiBjb3Vyc2UsIHdlXG5cdFx0Ly8gbmVlZCB0byBzYXZlIHRoZSBjaGlsZHJlbiBhbmQgdGV4dCBhcyB0aGV5IGFyZSBjb25jZXB0dWFsbHkgbm90XG5cdFx0Ly8gdW5saWtlIHNwZWNpYWwgXCJhdHRyaWJ1dGVzXCIgaW50ZXJuYWxseS5cblx0XHR2bm9kZS5hdHRycyA9IG9sZC5hdHRyc1xuXHRcdHZub2RlLmNoaWxkcmVuID0gb2xkLmNoaWxkcmVuXG5cdFx0dm5vZGUudGV4dCA9IG9sZC50ZXh0XG5cdFx0cmV0dXJuIHRydWVcblx0fVxuXG5cdHJldHVybiBmdW5jdGlvbihkb20sIHZub2RlcywgcmVkcmF3KSB7XG5cdFx0aWYgKCFkb20pIHRocm93IG5ldyBUeXBlRXJyb3IoXCJFbnN1cmUgdGhlIERPTSBlbGVtZW50IGJlaW5nIHBhc3NlZCB0byBtLnJvdXRlL20ubW91bnQvbS5yZW5kZXIgaXMgbm90IHVuZGVmaW5lZC5cIilcblx0XHR2YXIgaG9va3MgPSBbXVxuXHRcdHZhciBhY3RpdmUgPSBhY3RpdmVFbGVtZW50KClcblx0XHR2YXIgbmFtZXNwYWNlID0gZG9tLm5hbWVzcGFjZVVSSVxuXG5cdFx0Ly8gRmlyc3QgdGltZSByZW5kZXJpbmcgaW50byBhIG5vZGUgY2xlYXJzIGl0IG91dFxuXHRcdGlmIChkb20udm5vZGVzID09IG51bGwpIGRvbS50ZXh0Q29udGVudCA9IFwiXCJcblxuXHRcdHZub2RlcyA9IFZub2RlLm5vcm1hbGl6ZUNoaWxkcmVuKEFycmF5LmlzQXJyYXkodm5vZGVzKSA/IHZub2RlcyA6IFt2bm9kZXNdKVxuXHRcdHZhciBwcmV2UmVkcmF3ID0gY3VycmVudFJlZHJhd1xuXHRcdHRyeSB7XG5cdFx0XHRjdXJyZW50UmVkcmF3ID0gdHlwZW9mIHJlZHJhdyA9PT0gXCJmdW5jdGlvblwiID8gcmVkcmF3IDogdW5kZWZpbmVkXG5cdFx0XHR1cGRhdGVOb2Rlcyhkb20sIGRvbS52bm9kZXMsIHZub2RlcywgaG9va3MsIG51bGwsIG5hbWVzcGFjZSA9PT0gXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sXCIgPyB1bmRlZmluZWQgOiBuYW1lc3BhY2UpXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGN1cnJlbnRSZWRyYXcgPSBwcmV2UmVkcmF3XG5cdFx0fVxuXHRcdGRvbS52bm9kZXMgPSB2bm9kZXNcblx0XHQvLyBgZG9jdW1lbnQuYWN0aXZlRWxlbWVudGAgY2FuIHJldHVybiBudWxsOiBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9pbnRlcmFjdGlvbi5odG1sI2RvbS1kb2N1bWVudC1hY3RpdmVlbGVtZW50XG5cdFx0aWYgKGFjdGl2ZSAhPSBudWxsICYmIGFjdGl2ZUVsZW1lbnQoKSAhPT0gYWN0aXZlICYmIHR5cGVvZiBhY3RpdmUuZm9jdXMgPT09IFwiZnVuY3Rpb25cIikgYWN0aXZlLmZvY3VzKClcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgaSsrKSBob29rc1tpXSgpXG5cdH1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBWbm9kZSA9IHJlcXVpcmUoXCIuLi9yZW5kZXIvdm5vZGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihodG1sKSB7XG5cdGlmIChodG1sID09IG51bGwpIGh0bWwgPSBcIlwiXG5cdHJldHVybiBWbm9kZShcIjxcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGh0bWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCJcblxuZnVuY3Rpb24gVm5vZGUodGFnLCBrZXksIGF0dHJzLCBjaGlsZHJlbiwgdGV4dCwgZG9tKSB7XG5cdHJldHVybiB7dGFnOiB0YWcsIGtleToga2V5LCBhdHRyczogYXR0cnMsIGNoaWxkcmVuOiBjaGlsZHJlbiwgdGV4dDogdGV4dCwgZG9tOiBkb20sIGRvbVNpemU6IHVuZGVmaW5lZCwgc3RhdGU6IHVuZGVmaW5lZCwgZXZlbnRzOiB1bmRlZmluZWQsIGluc3RhbmNlOiB1bmRlZmluZWR9XG59XG5Wbm9kZS5ub3JtYWxpemUgPSBmdW5jdGlvbihub2RlKSB7XG5cdGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSByZXR1cm4gVm5vZGUoXCJbXCIsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBWbm9kZS5ub3JtYWxpemVDaGlsZHJlbihub2RlKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXG5cdGlmIChub2RlID09IG51bGwgfHwgdHlwZW9mIG5vZGUgPT09IFwiYm9vbGVhblwiKSByZXR1cm4gbnVsbFxuXHRpZiAodHlwZW9mIG5vZGUgPT09IFwib2JqZWN0XCIpIHJldHVybiBub2RlXG5cdHJldHVybiBWbm9kZShcIiNcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIFN0cmluZyhub2RlKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpXG59XG5Wbm9kZS5ub3JtYWxpemVDaGlsZHJlbiA9IGZ1bmN0aW9uKGlucHV0KSB7XG5cdHZhciBjaGlsZHJlbiA9IFtdXG5cdGlmIChpbnB1dC5sZW5ndGgpIHtcblx0XHR2YXIgaXNLZXllZCA9IGlucHV0WzBdICE9IG51bGwgJiYgaW5wdXRbMF0ua2V5ICE9IG51bGxcblx0XHQvLyBOb3RlOiB0aGlzIGlzIGEgKnZlcnkqIHBlcmYtc2Vuc2l0aXZlIGNoZWNrLlxuXHRcdC8vIEZ1biBmYWN0OiBtZXJnaW5nIHRoZSBsb29wIGxpa2UgdGhpcyBpcyBzb21laG93IGZhc3RlciB0aGFuIHNwbGl0dGluZ1xuXHRcdC8vIGl0LCBub3RpY2VhYmx5IHNvLlxuXHRcdGZvciAodmFyIGkgPSAxOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICgoaW5wdXRbaV0gIT0gbnVsbCAmJiBpbnB1dFtpXS5rZXkgIT0gbnVsbCkgIT09IGlzS2V5ZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihcIlZub2RlcyBtdXN0IGVpdGhlciBhbHdheXMgaGF2ZSBrZXlzIG9yIG5ldmVyIGhhdmUga2V5cyFcIilcblx0XHRcdH1cblx0XHR9XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y2hpbGRyZW5baV0gPSBWbm9kZS5ub3JtYWxpemUoaW5wdXRbaV0pXG5cdFx0fVxuXHR9XG5cdHJldHVybiBjaGlsZHJlblxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZub2RlXG4iLCJcInVzZSBzdHJpY3RcIlxuXG52YXIgUHJvbWlzZVBvbHlmaWxsID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wcm9taXNlXCIpXG52YXIgbW91bnRSZWRyYXcgPSByZXF1aXJlKFwiLi9tb3VudC1yZWRyYXdcIilcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9yZXF1ZXN0L3JlcXVlc3RcIikod2luZG93LCBQcm9taXNlUG9seWZpbGwsIG1vdW50UmVkcmF3LnJlZHJhdylcbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBidWlsZFBhdGhuYW1lID0gcmVxdWlyZShcIi4uL3BhdGhuYW1lL2J1aWxkXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHdpbmRvdywgUHJvbWlzZSwgb25jb21wbGV0aW9uKSB7XG5cdHZhciBjYWxsYmFja0NvdW50ID0gMFxuXG5cdGZ1bmN0aW9uIFByb21pc2VQcm94eShleGVjdXRvcikge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShleGVjdXRvcilcblx0fVxuXG5cdC8vIEluIGNhc2UgdGhlIGdsb2JhbCBQcm9taXNlIGlzIHNvbWUgdXNlcmxhbmQgbGlicmFyeSdzIHdoZXJlIHRoZXkgcmVseSBvblxuXHQvLyBgZm9vIGluc3RhbmNlb2YgdGhpcy5jb25zdHJ1Y3RvcmAsIGB0aGlzLmNvbnN0cnVjdG9yLnJlc29sdmUodmFsdWUpYCwgb3Jcblx0Ly8gc2ltaWxhci4gTGV0J3MgKm5vdCogYnJlYWsgdGhlbS5cblx0UHJvbWlzZVByb3h5LnByb3RvdHlwZSA9IFByb21pc2UucHJvdG90eXBlXG5cdFByb21pc2VQcm94eS5fX3Byb3RvX18gPSBQcm9taXNlIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tcHJvdG9cblxuXHRmdW5jdGlvbiBtYWtlUmVxdWVzdChmYWN0b3J5KSB7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKHVybCwgYXJncykge1xuXHRcdFx0aWYgKHR5cGVvZiB1cmwgIT09IFwic3RyaW5nXCIpIHsgYXJncyA9IHVybDsgdXJsID0gdXJsLnVybCB9XG5cdFx0XHRlbHNlIGlmIChhcmdzID09IG51bGwpIGFyZ3MgPSB7fVxuXHRcdFx0dmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdFx0ZmFjdG9yeShidWlsZFBhdGhuYW1lKHVybCwgYXJncy5wYXJhbXMpLCBhcmdzLCBmdW5jdGlvbiAoZGF0YSkge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgYXJncy50eXBlID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRcdGRhdGFbaV0gPSBuZXcgYXJncy50eXBlKGRhdGFbaV0pXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2UgZGF0YSA9IG5ldyBhcmdzLnR5cGUoZGF0YSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVzb2x2ZShkYXRhKVxuXHRcdFx0XHR9LCByZWplY3QpXG5cdFx0XHR9KVxuXHRcdFx0aWYgKGFyZ3MuYmFja2dyb3VuZCA9PT0gdHJ1ZSkgcmV0dXJuIHByb21pc2Vcblx0XHRcdHZhciBjb3VudCA9IDBcblx0XHRcdGZ1bmN0aW9uIGNvbXBsZXRlKCkge1xuXHRcdFx0XHRpZiAoLS1jb3VudCA9PT0gMCAmJiB0eXBlb2Ygb25jb21wbGV0aW9uID09PSBcImZ1bmN0aW9uXCIpIG9uY29tcGxldGlvbigpXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB3cmFwKHByb21pc2UpXG5cblx0XHRcdGZ1bmN0aW9uIHdyYXAocHJvbWlzZSkge1xuXHRcdFx0XHR2YXIgdGhlbiA9IHByb21pc2UudGhlblxuXHRcdFx0XHQvLyBTZXQgdGhlIGNvbnN0cnVjdG9yLCBzbyBlbmdpbmVzIGtub3cgdG8gbm90IGF3YWl0IG9yIHJlc29sdmVcblx0XHRcdFx0Ly8gdGhpcyBhcyBhIG5hdGl2ZSBwcm9taXNlLiBBdCB0aGUgdGltZSBvZiB3cml0aW5nLCB0aGlzIGlzXG5cdFx0XHRcdC8vIG9ubHkgbmVjZXNzYXJ5IGZvciBWOCwgYnV0IHRoZWlyIGJlaGF2aW9yIGlzIHRoZSBjb3JyZWN0XG5cdFx0XHRcdC8vIGJlaGF2aW9yIHBlciBzcGVjLiBTZWUgdGhpcyBzcGVjIGlzc3VlIGZvciBtb3JlIGRldGFpbHM6XG5cdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS90YzM5L2VjbWEyNjIvaXNzdWVzLzE1NzcuIEFsc28sIHNlZSB0aGVcblx0XHRcdFx0Ly8gY29ycmVzcG9uZGluZyBjb21tZW50IGluIGByZXF1ZXN0L3Rlc3RzL3Rlc3QtcmVxdWVzdC5qc2AgZm9yXG5cdFx0XHRcdC8vIGEgYml0IG1vcmUgYmFja2dyb3VuZCBvbiB0aGUgaXNzdWUgYXQgaGFuZC5cblx0XHRcdFx0cHJvbWlzZS5jb25zdHJ1Y3RvciA9IFByb21pc2VQcm94eVxuXHRcdFx0XHRwcm9taXNlLnRoZW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRjb3VudCsrXG5cdFx0XHRcdFx0dmFyIG5leHQgPSB0aGVuLmFwcGx5KHByb21pc2UsIGFyZ3VtZW50cylcblx0XHRcdFx0XHRuZXh0LnRoZW4oY29tcGxldGUsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRcdGNvbXBsZXRlKClcblx0XHRcdFx0XHRcdGlmIChjb3VudCA9PT0gMCkgdGhyb3cgZVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0cmV0dXJuIHdyYXAobmV4dClcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcHJvbWlzZVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGhhc0hlYWRlcihhcmdzLCBuYW1lKSB7XG5cdFx0Zm9yICh2YXIga2V5IGluIGFyZ3MuaGVhZGVycykge1xuXHRcdFx0aWYgKHt9Lmhhc093blByb3BlcnR5LmNhbGwoYXJncy5oZWFkZXJzLCBrZXkpICYmIG5hbWUudGVzdChrZXkpKSByZXR1cm4gdHJ1ZVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0cmVxdWVzdDogbWFrZVJlcXVlc3QoZnVuY3Rpb24odXJsLCBhcmdzLCByZXNvbHZlLCByZWplY3QpIHtcblx0XHRcdHZhciBtZXRob2QgPSBhcmdzLm1ldGhvZCAhPSBudWxsID8gYXJncy5tZXRob2QudG9VcHBlckNhc2UoKSA6IFwiR0VUXCJcblx0XHRcdHZhciBib2R5ID0gYXJncy5ib2R5XG5cdFx0XHR2YXIgYXNzdW1lSlNPTiA9IChhcmdzLnNlcmlhbGl6ZSA9PSBudWxsIHx8IGFyZ3Muc2VyaWFsaXplID09PSBKU09OLnNlcmlhbGl6ZSkgJiYgIShib2R5IGluc3RhbmNlb2YgJHdpbmRvdy5Gb3JtRGF0YSlcblx0XHRcdHZhciByZXNwb25zZVR5cGUgPSBhcmdzLnJlc3BvbnNlVHlwZSB8fCAodHlwZW9mIGFyZ3MuZXh0cmFjdCA9PT0gXCJmdW5jdGlvblwiID8gXCJcIiA6IFwianNvblwiKVxuXG5cdFx0XHR2YXIgeGhyID0gbmV3ICR3aW5kb3cuWE1MSHR0cFJlcXVlc3QoKSwgYWJvcnRlZCA9IGZhbHNlXG5cdFx0XHR2YXIgb3JpZ2luYWwgPSB4aHIsIHJlcGxhY2VkQWJvcnRcblx0XHRcdHZhciBhYm9ydCA9IHhoci5hYm9ydFxuXG5cdFx0XHR4aHIuYWJvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0YWJvcnRlZCA9IHRydWVcblx0XHRcdFx0YWJvcnQuY2FsbCh0aGlzKVxuXHRcdFx0fVxuXG5cdFx0XHR4aHIub3BlbihtZXRob2QsIHVybCwgYXJncy5hc3luYyAhPT0gZmFsc2UsIHR5cGVvZiBhcmdzLnVzZXIgPT09IFwic3RyaW5nXCIgPyBhcmdzLnVzZXIgOiB1bmRlZmluZWQsIHR5cGVvZiBhcmdzLnBhc3N3b3JkID09PSBcInN0cmluZ1wiID8gYXJncy5wYXNzd29yZCA6IHVuZGVmaW5lZClcblxuXHRcdFx0aWYgKGFzc3VtZUpTT04gJiYgYm9keSAhPSBudWxsICYmICFoYXNIZWFkZXIoYXJncywgL15jb250ZW50LXR5cGUkL2kpKSB7XG5cdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIsIFwiYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOFwiKVxuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBhcmdzLmRlc2VyaWFsaXplICE9PSBcImZ1bmN0aW9uXCIgJiYgIWhhc0hlYWRlcihhcmdzLCAvXmFjY2VwdCQvaSkpIHtcblx0XHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoXCJBY2NlcHRcIiwgXCJhcHBsaWNhdGlvbi9qc29uLCB0ZXh0LypcIilcblx0XHRcdH1cblx0XHRcdGlmIChhcmdzLndpdGhDcmVkZW50aWFscykgeGhyLndpdGhDcmVkZW50aWFscyA9IGFyZ3Mud2l0aENyZWRlbnRpYWxzXG5cdFx0XHRpZiAoYXJncy50aW1lb3V0KSB4aHIudGltZW91dCA9IGFyZ3MudGltZW91dFxuXHRcdFx0eGhyLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZVxuXG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gYXJncy5oZWFkZXJzKSB7XG5cdFx0XHRcdGlmICh7fS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGFyZ3MuaGVhZGVycywga2V5KSkge1xuXHRcdFx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgYXJncy5oZWFkZXJzW2tleV0pXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0eGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKGV2KSB7XG5cdFx0XHRcdC8vIERvbid0IHRocm93IGVycm9ycyBvbiB4aHIuYWJvcnQoKS5cblx0XHRcdFx0aWYgKGFib3J0ZWQpIHJldHVyblxuXG5cdFx0XHRcdGlmIChldi50YXJnZXQucmVhZHlTdGF0ZSA9PT0gNCkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR2YXIgc3VjY2VzcyA9IChldi50YXJnZXQuc3RhdHVzID49IDIwMCAmJiBldi50YXJnZXQuc3RhdHVzIDwgMzAwKSB8fCBldi50YXJnZXQuc3RhdHVzID09PSAzMDQgfHwgKC9eZmlsZTpcXC9cXC8vaSkudGVzdCh1cmwpXG5cdFx0XHRcdFx0XHQvLyBXaGVuIHRoZSByZXNwb25zZSB0eXBlIGlzbid0IFwiXCIgb3IgXCJ0ZXh0XCIsXG5cdFx0XHRcdFx0XHQvLyBgeGhyLnJlc3BvbnNlVGV4dGAgaXMgdGhlIHdyb25nIHRoaW5nIHRvIHVzZS5cblx0XHRcdFx0XHRcdC8vIEJyb3dzZXJzIGRvIHRoZSByaWdodCB0aGluZyBhbmQgdGhyb3cgaGVyZSwgYW5kIHdlXG5cdFx0XHRcdFx0XHQvLyBzaG91bGQgaG9ub3IgdGhhdCBhbmQgZG8gdGhlIHJpZ2h0IHRoaW5nIGJ5XG5cdFx0XHRcdFx0XHQvLyBwcmVmZXJyaW5nIGB4aHIucmVzcG9uc2VgIHdoZXJlIHBvc3NpYmxlL3ByYWN0aWNhbC5cblx0XHRcdFx0XHRcdHZhciByZXNwb25zZSA9IGV2LnRhcmdldC5yZXNwb25zZSwgbWVzc2FnZVxuXG5cdFx0XHRcdFx0XHRpZiAocmVzcG9uc2VUeXBlID09PSBcImpzb25cIikge1xuXHRcdFx0XHRcdFx0XHQvLyBGb3IgSUUgYW5kIEVkZ2UsIHdoaWNoIGRvbid0IGltcGxlbWVudFxuXHRcdFx0XHRcdFx0XHQvLyBgcmVzcG9uc2VUeXBlOiBcImpzb25cImAuXG5cdFx0XHRcdFx0XHRcdGlmICghZXYudGFyZ2V0LnJlc3BvbnNlVHlwZSAmJiB0eXBlb2YgYXJncy5leHRyYWN0ICE9PSBcImZ1bmN0aW9uXCIpIHJlc3BvbnNlID0gSlNPTi5wYXJzZShldi50YXJnZXQucmVzcG9uc2VUZXh0KVxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICghcmVzcG9uc2VUeXBlIHx8IHJlc3BvbnNlVHlwZSA9PT0gXCJ0ZXh0XCIpIHtcblx0XHRcdFx0XHRcdFx0Ly8gT25seSB1c2UgdGhpcyBkZWZhdWx0IGlmIGl0J3MgdGV4dC4gSWYgYSBwYXJzZWRcblx0XHRcdFx0XHRcdFx0Ly8gZG9jdW1lbnQgaXMgbmVlZGVkIG9uIG9sZCBJRSBhbmQgZnJpZW5kcyAoYWxsXG5cdFx0XHRcdFx0XHRcdC8vIHVuc3VwcG9ydGVkKSwgdGhlIHVzZXIgc2hvdWxkIHVzZSBhIGN1c3RvbVxuXHRcdFx0XHRcdFx0XHQvLyBgY29uZmlnYCBpbnN0ZWFkLiBUaGV5J3JlIGFscmVhZHkgdXNpbmcgdGhpcyBhdFxuXHRcdFx0XHRcdFx0XHQvLyB0aGVpciBvd24gcmlzay5cblx0XHRcdFx0XHRcdFx0aWYgKHJlc3BvbnNlID09IG51bGwpIHJlc3BvbnNlID0gZXYudGFyZ2V0LnJlc3BvbnNlVGV4dFxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIGFyZ3MuZXh0cmFjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlID0gYXJncy5leHRyYWN0KGV2LnRhcmdldCwgYXJncylcblx0XHRcdFx0XHRcdFx0c3VjY2VzcyA9IHRydWVcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIGFyZ3MuZGVzZXJpYWxpemUgPT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdFx0XHRyZXNwb25zZSA9IGFyZ3MuZGVzZXJpYWxpemUocmVzcG9uc2UpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoc3VjY2VzcykgcmVzb2x2ZShyZXNwb25zZSlcblx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0cnkgeyBtZXNzYWdlID0gZXYudGFyZ2V0LnJlc3BvbnNlVGV4dCB9XG5cdFx0XHRcdFx0XHRcdGNhdGNoIChlKSB7IG1lc3NhZ2UgPSByZXNwb25zZSB9XG5cdFx0XHRcdFx0XHRcdHZhciBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKVxuXHRcdFx0XHRcdFx0XHRlcnJvci5jb2RlID0gZXYudGFyZ2V0LnN0YXR1c1xuXHRcdFx0XHRcdFx0XHRlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlXG5cdFx0XHRcdFx0XHRcdHJlamVjdChlcnJvcilcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHJlamVjdChlKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIGFyZ3MuY29uZmlnID09PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0eGhyID0gYXJncy5jb25maWcoeGhyLCBhcmdzLCB1cmwpIHx8IHhoclxuXG5cdFx0XHRcdC8vIFByb3BhZ2F0ZSB0aGUgYGFib3J0YCB0byBhbnkgcmVwbGFjZW1lbnQgWEhSIGFzIHdlbGwuXG5cdFx0XHRcdGlmICh4aHIgIT09IG9yaWdpbmFsKSB7XG5cdFx0XHRcdFx0cmVwbGFjZWRBYm9ydCA9IHhoci5hYm9ydFxuXHRcdFx0XHRcdHhoci5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0YWJvcnRlZCA9IHRydWVcblx0XHRcdFx0XHRcdHJlcGxhY2VkQWJvcnQuY2FsbCh0aGlzKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYm9keSA9PSBudWxsKSB4aHIuc2VuZCgpXG5cdFx0XHRlbHNlIGlmICh0eXBlb2YgYXJncy5zZXJpYWxpemUgPT09IFwiZnVuY3Rpb25cIikgeGhyLnNlbmQoYXJncy5zZXJpYWxpemUoYm9keSkpXG5cdFx0XHRlbHNlIGlmIChib2R5IGluc3RhbmNlb2YgJHdpbmRvdy5Gb3JtRGF0YSkgeGhyLnNlbmQoYm9keSlcblx0XHRcdGVsc2UgeGhyLnNlbmQoSlNPTi5zdHJpbmdpZnkoYm9keSkpXG5cdFx0fSksXG5cdFx0anNvbnA6IG1ha2VSZXF1ZXN0KGZ1bmN0aW9uKHVybCwgYXJncywgcmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0XHR2YXIgY2FsbGJhY2tOYW1lID0gYXJncy5jYWxsYmFja05hbWUgfHwgXCJfbWl0aHJpbF9cIiArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDFlMTYpICsgXCJfXCIgKyBjYWxsYmFja0NvdW50Kytcblx0XHRcdHZhciBzY3JpcHQgPSAkd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIilcblx0XHRcdCR3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdFx0ZGVsZXRlICR3aW5kb3dbY2FsbGJhY2tOYW1lXVxuXHRcdFx0XHRzY3JpcHQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHQpXG5cdFx0XHRcdHJlc29sdmUoZGF0YSlcblx0XHRcdH1cblx0XHRcdHNjcmlwdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGRlbGV0ZSAkd2luZG93W2NhbGxiYWNrTmFtZV1cblx0XHRcdFx0c2NyaXB0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoc2NyaXB0KVxuXHRcdFx0XHRyZWplY3QobmV3IEVycm9yKFwiSlNPTlAgcmVxdWVzdCBmYWlsZWRcIikpXG5cdFx0XHR9XG5cdFx0XHRzY3JpcHQuc3JjID0gdXJsICsgKHVybC5pbmRleE9mKFwiP1wiKSA8IDAgPyBcIj9cIiA6IFwiJlwiKSArXG5cdFx0XHRcdGVuY29kZVVSSUNvbXBvbmVudChhcmdzLmNhbGxiYWNrS2V5IHx8IFwiY2FsbGJhY2tcIikgKyBcIj1cIiArXG5cdFx0XHRcdGVuY29kZVVSSUNvbXBvbmVudChjYWxsYmFja05hbWUpXG5cdFx0XHQkd2luZG93LmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChzY3JpcHQpXG5cdFx0fSksXG5cdH1cbn1cbiIsIlwidXNlIHN0cmljdFwiXG5cbnZhciBtb3VudFJlZHJhdyA9IHJlcXVpcmUoXCIuL21vdW50LXJlZHJhd1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2FwaS9yb3V0ZXJcIikod2luZG93LCBtb3VudFJlZHJhdylcbiIsImltcG9ydCBtIGZyb20gXCJtaXRocmlsXCI7XG5cblxubGV0IGF1dGggPSB7XG4gICAgdXJsOiBcImh0dHBzOi8vbGFnZXIuZW1pbGZvbGluby5zZS92Mi9hdXRoL2xvZ2luXCIsXG4gICAgZW1haWw6IFwiXCIsXG4gICAgcGFzc3dvcmQ6IFwiXCIsXG4gICAgdG9rZW46IFwiXCIsXG5cbiAgICBsb2dpbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIG0ucmVxdWVzdCh7XG4gICAgICAgICAgICB1cmw6IGF1dGgudXJsLFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IHtcbiAgICAgICAgICAgICAgICBlbWFpbDogYXV0aC5lbWFpbCxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogYXV0aC5wYXNzd29yZCxcbiAgICAgICAgICAgICAgICBhcGlfa2V5OiBcIjc4NWEyNjRjNDhlZGQyMzdlMjlkMWFlOTViZjM5ODU5XCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIGF1dGguZW1haWwgPSBcIlwiO1xuICAgICAgICAgICAgYXV0aC5wYXNzd29yZCA9IFwiXCI7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHQuZGF0YS50b2tlbik7XG5cbiAgICAgICAgICAgIGF1dGgudG9rZW4gPSByZXN1bHQuZGF0YS50b2tlbjtcbiAgICAgICAgICAgIHJldHVybiBtLnJvdXRlLnNldChcIi9cIik7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGF1dGg7XG4iLCJpbXBvcnQgbSBmcm9tIFwibWl0aHJpbFwiO1xuXG5cbmxldCBjb2NrdGFpbHNNb2RlbCA9IHtcbiAgICBjdXJyZW50OiB7fSxcbiAgICBnZXRDb2NrdGFpbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIG0ucmVxdWVzdCh7XG4gICAgICAgICAgICB1cmw6IGBodHRwczovL3d3dy50aGVjb2NrdGFpbGRiLmNvbS9hcGkvanNvbi92MS8xL3JhbmRvbS5waHBgLFxuICAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2cocmVzdWx0LmRyaW5rc1swXSk7XG4gICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50ID0gcmVzdWx0LmRyaW5rc1swXTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvY2t0YWlsc01vZGVsLmN1cnJlbnQpO1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBjb2NrdGFpbHNNb2RlbDtcbiIsImltcG9ydCBtIGZyb20gXCJtaXRocmlsXCI7XG5cblxubGV0IGZvb2RNb2RlbCA9IHtcbiAgICBjdXJyZW50OiB7fSxcbiAgICBnZXRGb29kOiBmdW5jdGlvbigpIHtcbiAgICAgICAgbS5yZXF1ZXN0KHtcbiAgICAgICAgICAgIHVybDogYGh0dHBzOi8vd3d3LnRoZW1lYWxkYi5jb20vYXBpL2pzb24vdjEvMS9yYW5kb20ucGhwYCxcbiAgICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3VsdC5kcmlua3NbMF0pO1xuICAgICAgICAgICAgZm9vZE1vZGVsLmN1cnJlbnQgPSByZXN1bHQubWVhbHNbMF07XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhmb29kTW9kZWwuY3VycmVudCk7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGZvb2RNb2RlbDtcbiIsImltcG9ydCBtIGZyb20gXCJtaXRocmlsXCI7XG5pbXBvcnQgTW92aWVzIGZyb20gJy4vbGlua3MvbGlua3MuanNvbic7XG5cblxubGV0IG1vdmllc01vZGVsID0ge1xuICAgIHVybDogXCJodHRwOi8vd3d3Lm9tZGJhcGkuY29tL1wiLFxuICAgIGN1cnJlbnQ6IHt9LFxuICAgIGdldE1vdmllczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByYW5kb21OdW1iZXIgPSBNb3ZpZXMuTW92aWVzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDgwMDApXTtcblxuICAgICAgICBtLnJlcXVlc3Qoe1xuICAgICAgICAgICAgdXJsOiBgJHttb3ZpZXNNb2RlbC51cmx9P2FwaWtleT01NTYyMzk0NCZpPXR0JHtyYW5kb21OdW1iZXJ9JnBsb3Q9ZnVsbGAsXG4gICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICBtb3ZpZXNNb2RlbC5jdXJyZW50ID0gcmVzdWx0O1xuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBtb3ZpZXNNb2RlbDtcbiIsImltcG9ydCBtIGZyb20gXCJtaXRocmlsXCI7XG5cblxubGV0IHJlZ2kgPSB7XG4gICAgdXJsOiBcImh0dHBzOi8vbGFnZXIuZW1pbGZvbGluby5zZS92Mi9hdXRoL3JlZ2lzdGVyXCIsXG4gICAgZW1haWw6IFwiXCIsXG4gICAgcGFzc3dvcmQ6IFwiXCIsXG4gICAgdG9rZW46IFwiXCIsXG5cbiAgICByZWdpc3RlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIG0ucmVxdWVzdCh7XG4gICAgICAgICAgICB1cmw6IHJlZ2kudXJsLFxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGJvZHk6IHtcbiAgICAgICAgICAgICAgICBlbWFpbDogcmVnaS5lbWFpbCxcbiAgICAgICAgICAgICAgICBwYXNzd29yZDogcmVnaS5wYXNzd29yZCxcbiAgICAgICAgICAgICAgICBhcGlfa2V5OiBcIjc4NWEyNjRjNDhlZGQyMzdlMjlkMWFlOTViZjM5ODU5XCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgIHJlZ2kuZW1haWwgPSBcIlwiO1xuICAgICAgICAgICAgcmVnaS5wYXNzd29yZCA9IFwiXCI7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHQuZGF0YS50b2tlbik7XG5cbiAgICAgICAgICAgIHJlZ2kudG9rZW4gPSByZXN1bHQuZGF0YS50b2tlbjtcbiAgICAgICAgICAgIHJldHVybiBtLnJvdXRlLnNldChcIi9cIik7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IHJlZ2k7XG4iLCJpbXBvcnQgbSBmcm9tIFwibWl0aHJpbFwiO1xuXG5pbXBvcnQgY29ja3RhaWxzTW9kZWwgZnJvbSBcIi4uL21vZGVscy9jb2NrdGFpbHMuanNcIjtcblxubGV0IGNvY2t0YWlscyA9IHtcbiAgICBvbmluaXQ6IGNvY2t0YWlsc01vZGVsLmdldENvY2t0YWlsLFxuICAgIHZpZXc6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgbShcImgxLmNlbnRlclwiLCBcIldoYXQgY29ja3RhaWwgc2hvdWxkIEkgbWFrZT9cIiksXG4gICAgICAgICAgICBtKFwiZm9ybVwiLCB7XG4gICAgICAgICAgICAgICAgb25zdWJtaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuZ2V0Q29ja3RhaWwoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIFwiWW91IHNob3VsZCBtYWtlIGEuLlwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJoMy5jZW50ZXJcIiwgbShcImJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJEcmluaykpLFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcImltZ1wiLCB7XG4gICAgICAgICAgICAgICAgXCJjbGFzc1wiOiBcIm1vdmllSW1nXCIsXG4gICAgICAgICAgICAgICAgXCJzcmNcIjogY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJEcmlua1RodW1iXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJidXR0b24uYnV0dG9uQ2VudGVyXCIsIFwiTmV4dCBjb2NrdGFpbFwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJoMS5jZW50ZXJcIiwgXCJDb2NrdGFpbC1pbmZvXCIpLFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcImRpdi5pbmZvRGl2XCIsXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIG0oXCJiXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyQWxjb2hvbGljICsgXCIgYmV2ZXJhZ2VcIlxuICAgICAgICAgICAgICAgICkpLFxuICAgICAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMSwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDEpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmUyLCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MiksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTMsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQzKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlNCwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDQpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmU1LCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50NSksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTYsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQ2KSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlNywgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDcpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmU4LCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50OCksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTksIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQ5KSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTAsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQxMCksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTExLCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTEpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmUxMiwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDEyKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTMsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQxMyksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTE0LCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgY29ja3RhaWxzTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTQpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBjb2NrdGFpbHNNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmUxNSwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDE1KSxcbiAgICAgICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsXG4gICAgICAgICAgICAgICAgICAgIGNvY2t0YWlsc01vZGVsLmN1cnJlbnQuc3RySW5zdHJ1Y3Rpb25zXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICBdO1xuICAgIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNvY2t0YWlscztcbiIsImltcG9ydCBtIGZyb20gXCJtaXRocmlsXCI7XG5cbmltcG9ydCBmb29kTW9kZWwgZnJvbSBcIi4uL21vZGVscy9mb29kLmpzXCI7XG5cbmxldCBmb29kcyA9IHtcbiAgICBvbmluaXQ6IGZvb2RNb2RlbC5nZXRGb29kLFxuICAgIHZpZXc6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgbShcImgxLmNlbnRlclwiLCBcIldoYXQgZm9vZCBzaG91bGQgSSBtYWtlP1wiKSxcbiAgICAgICAgICAgIG0oXCJmb3JtXCIsIHtcbiAgICAgICAgICAgICAgICBvbnN1Ym1pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuZ2V0Rm9vZCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgXCJZb3Ugc2hvdWxkIGNvb2suLlwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJoMy5jZW50ZXJcIiwgbShcImJcIiwgZm9vZE1vZGVsLmN1cnJlbnQuc3RyTWVhbCkpLFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcImltZ1wiLCB7XG4gICAgICAgICAgICAgICAgXCJjbGFzc1wiOiBcIm1vdmllSW1nXCIsXG4gICAgICAgICAgICAgICAgXCJzcmNcIjogZm9vZE1vZGVsLmN1cnJlbnQuc3RyTWVhbFRodW1iXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJidXR0b24uYnV0dG9uQ2VudGVyXCIsIFwiTmV4dCByZWNpcGVcIiksXG4gICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICBtKFwiaDEuY2VudGVyXCIsIFwiRm9vZC1pbmZvXCIpLFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcImRpdi5pbmZvRGl2XCIsXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIG0oXCJiXCIsXG4gICAgICAgICAgICAgICAgICAgIGZvb2RNb2RlbC5jdXJyZW50LnN0ckNhdGVnb3J5XG4gICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMSwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGZvb2RNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQxKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgZm9vZE1vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTIsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MiksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGZvb2RNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmUzLCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgZm9vZE1vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDMpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlNCwgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGZvb2RNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQ0KSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgZm9vZE1vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTUsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50NSksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGZvb2RNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmU2LCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgZm9vZE1vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDYpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlNywgXCIgXCIsXG4gICAgICAgICAgICAgICAgICAgIGZvb2RNb2RlbC5jdXJyZW50LnN0ckluZ3JlZGllbnQ3KSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgZm9vZE1vZGVsLmN1cnJlbnQuc3RyTWVhc3VyZTgsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50OCksXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIGZvb2RNb2RlbC5jdXJyZW50LnN0ck1lYXN1cmU5LCBcIiBcIixcbiAgICAgICAgICAgICAgICAgICAgZm9vZE1vZGVsLmN1cnJlbnQuc3RySW5ncmVkaWVudDkpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTAsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTApLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTEsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTEpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTIsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTIpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTMsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTMpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTQsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTQpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTUsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTUpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTYsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTYpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTcsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTcpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTgsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTgpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMTksIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MTkpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBmb29kTW9kZWwuY3VycmVudC5zdHJNZWFzdXJlMjAsIFwiIFwiLFxuICAgICAgICAgICAgICAgICAgICBmb29kTW9kZWwuY3VycmVudC5zdHJJbmdyZWRpZW50MjApLFxuICAgICAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIixcbiAgICAgICAgICAgICAgICAgICAgZm9vZE1vZGVsLmN1cnJlbnQuc3RySW5zdHJ1Y3Rpb25zXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIF07XG4gICAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZm9vZHM7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuaW1wb3J0IG0gZnJvbSAnbWl0aHJpbCc7XG5pbXBvcnQgYXV0aCBmcm9tICcuLi9tb2RlbHMvYXV0aC5qcyc7XG5cbmxldCBsYXlvdXQgPSB7XG4gICAgdmlldzogZnVuY3Rpb24odm5vZGUpIHtcbiAgICAgICAgaWYgKGF1dGgudG9rZW4ubGVuZ3RoID4gMjApIHtcbiAgICAgICAgICAgIHJldHVybiBtKFwibWFpblwiLCBbXG4gICAgICAgICAgICAgICAgbShcIm5hdmJhci5uYXZiYXJcIiwgW1xuICAgICAgICAgICAgICAgICAgICBtKFwiZGl2LmNvbnRhaW5lclwiLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICBtKFwidWwubmF2XCIsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtKFwibGlcIiwgW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtKFwiYVwiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBocmVmOiBcIiMhL21vdmllc1wiIH0sIFwiTW92aWVzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbShcImxpXCIsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbShcImFcIiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaHJlZjogXCIjIS9jb2NrdGFpbHNcIiB9LCBcIkNvY2t0YWlsc1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0oXCJsaVwiLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0oXCJhXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhyZWY6IFwiIyEvZm9vZHNcIiB9LCBcIkZvb2RzXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICBdKSxcbiAgICAgICAgICAgICAgICBtKFwic2VjdGlvbi5jb250YWluZXJcIiwgdm5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBtKFwibWFpblwiLCBbXG4gICAgICAgICAgICAgICAgbShcIm5hdmJhci5uYXZiYXJcIiwgW1xuICAgICAgICAgICAgICAgICAgICBtKFwiZGl2LmNvbnRhaW5lclwiLCBbXG4gICAgICAgICAgICAgICAgICAgICAgICBtKFwidWwubmF2XCIsIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtKFwibGlcIiwgW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtKFwiYVwiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBocmVmOiBcIiMhL2xvZ2luXCIgfSwgXCJMb2dpblwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICAgIG0oXCJzZWN0aW9uLmNvbnRhaW5lclwiLCB2bm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIF0pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbGF5b3V0O1xuIiwiaW1wb3J0IG0gZnJvbSBcIm1pdGhyaWxcIjtcbmltcG9ydCBhdXRoIGZyb20gXCIuLi9tb2RlbHMvYXV0aFwiO1xuXG5cbmxldCBsb2dpbiA9IHtcbiAgICB2aWV3OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIG0oXCJoMS5jZW50ZXJcIiwgXCJXZWxjb21lIHRvIEVkZGllcyBwcm9qZWN0ISFcIiksXG4gICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgXCJMb2dpbiB0byBjb250aW51ZS5cIiksXG5cbiAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLFxuICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAgXCJObyBhY2NvdW50PyBcIixcbiAgICAgICAgICAgICAgICAgICAgbShcImFcIiwge2hyZWY6IFwiIyEvcmVnaXN0ZXJcIn0sXG4gICAgICAgICAgICAgICAgICAgICAgICBcIlJlZ2lzdGVyIGhlcmUhXCJcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBtKFwiZm9ybVwiLCB7XG4gICAgICAgICAgICAgICAgb25zdWJtaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgYXV0aC5sb2dpbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtKFwibGFiZWwuaW5wdXQtbGFiZWxcIiwgXCJFLW1haWxcIiksXG4gICAgICAgICAgICBtKFwiaW5wdXRbdHlwZT1lbWFpbF0uaW5wdXRcIiwge1xuICAgICAgICAgICAgICAgIG9uaW5wdXQ6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBhdXRoLmVtYWlsID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IGF1dGguZW1haWxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbShcImxhYmVsLmlucHV0LWxhYmVsXCIsIFwiUGFzc3dvcmRcIiksXG4gICAgICAgICAgICBtKFwiaW5wdXRbdHlwZT1wYXNzd29yZF0uaW5wdXRcIiwge1xuICAgICAgICAgICAgICAgIG9uaW5wdXQ6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICBhdXRoLnBhc3N3b3JkID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IGF1dGgucGFzc3dvcmRcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbShcImlucHV0W3R5cGU9c3VibWl0XVt2YWx1ZT1Mb2cgaW5dLmJ1dHRvbkNlbnRlclwiLCBcIkxvZyBpblwiKVxuICAgICAgICAgICAgKVxuICAgICAgICBdO1xuICAgIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGxvZ2luO1xuIiwiaW1wb3J0IG0gZnJvbSBcIm1pdGhyaWxcIjtcblxuaW1wb3J0IG1vdmllTW9kZWwgZnJvbSBcIi4uL21vZGVscy9tb3ZpZXMuanNcIjtcblxubGV0IG1vdmllcyA9IHtcbiAgICBvbmluaXQ6IG1vdmllTW9kZWwuZ2V0TW92aWVzLFxuICAgIHZpZXc6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgbShcImgxLmNlbnRlclwiLCBcIldoYXQgbW92aWUgc2hvdWxkIEkgd2F0Y2g/XCIpLFxuICAgICAgICAgICAgbShcImZvcm1cIiwge1xuICAgICAgICAgICAgICAgIG9uc3VibWl0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vdmllTW9kZWwuZ2V0TW92aWVzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBcIllvdSBzaG91bGQgd2F0Y2guLlwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJoMy5jZW50ZXJcIiwgbShcImJcIiwgbW92aWVNb2RlbC5jdXJyZW50LlRpdGxlKSksXG4gICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICBtKFwiaW1nXCIsIHtcbiAgICAgICAgICAgICAgICBcImNsYXNzXCI6IFwibW92aWVJbWdcIixcbiAgICAgICAgICAgICAgICBcInNyY1wiOiBtb3ZpZU1vZGVsLmN1cnJlbnQuUG9zdGVyXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJidXR0b24uYnV0dG9uQ2VudGVyXCIsIFwiTmV4dCBtb3ZpZVwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgIG0oXCJoMS5jZW50ZXJcIiwgXCJNb3ZpZS1pbmZvXCIpLFxuICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgbShcImRpdi5pbmZvRGl2XCIsXG4gICAgICAgICAgICAgICAgbShcInAuY2VudGVyXCIsIG0oXCJiXCIsXG4gICAgICAgICAgICAgICAgICAgIG1vdmllTW9kZWwuY3VycmVudC5ZZWFyXG4gICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLFxuICAgICAgICAgICAgICAgICAgICBtb3ZpZU1vZGVsLmN1cnJlbnQuTGFuZ3VhZ2VcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIG0oXCJiclwiKSxcbiAgICAgICAgICAgICAgICBtKFwicC5jZW50ZXJcIiwgbShcImJcIiwgXCJBY3RvcnNcIiksIG0oXCJiclwiKSxcbiAgICAgICAgICAgICAgICAgICAgbW92aWVNb2RlbC5jdXJyZW50LkFjdG9yc1xuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLFxuICAgICAgICAgICAgICAgICAgICBtb3ZpZU1vZGVsLmN1cnJlbnQuUGxvdFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgbShcImJyXCIpLFxuICAgICAgICAgICAgICAgIG0oXCJwLmNlbnRlclwiLCBtKFwiYlwiLFxuICAgICAgICAgICAgICAgICAgICBcIklNREIgUkFUSU5HIFwiICsgbW92aWVNb2RlbC5jdXJyZW50LmltZGJSYXRpbmdcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBtKFwiYnJcIiksXG4gICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIF07XG4gICAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbW92aWVzO1xuIiwiaW1wb3J0IG0gZnJvbSBcIm1pdGhyaWxcIjtcbmltcG9ydCByZWdpIGZyb20gXCIuLi9tb2RlbHMvcmVnaVwiO1xuXG5cbmxldCByZWdpc3RlciA9IHtcbiAgICB2aWV3OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIG0oXCJoMVwiLCBcIlJlZ2lzdGVyIGFjY291bnRcIiksXG4gICAgICAgICAgICBtKFwiZm9ybVwiLCB7XG4gICAgICAgICAgICAgICAgb25zdWJtaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVnaS5yZWdpc3RlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtKFwibGFiZWwuaW5wdXQtbGFiZWxcIiwgXCJFLW1haWxcIiksXG4gICAgICAgICAgICBtKFwiaW5wdXRbdHlwZT1lbWFpbF0uaW5wdXRcIiwge1xuICAgICAgICAgICAgICAgIG9uaW5wdXQ6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZWdpLmVtYWlsID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IHJlZ2kuZW1haWxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbShcImxhYmVsLmlucHV0LWxhYmVsXCIsIFwiUGFzc3dvcmRcIiksXG4gICAgICAgICAgICBtKFwiaW5wdXRbdHlwZT1wYXNzd29yZF0uaW5wdXRcIiwge1xuICAgICAgICAgICAgICAgIG9uaW5wdXQ6IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZWdpLnBhc3N3b3JkID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmFsdWU6IHJlZ2kucGFzc3dvcmRcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbShcImlucHV0W3R5cGU9c3VibWl0XVt2YWx1ZT1SZWdpc3RyZXJhXS5idXR0b25cIiwgXCJSZWdpc3RyZXJhXCIpXG4gICAgICAgICAgICApXG4gICAgICAgIF07XG4gICAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgcmVnaXN0ZXI7XG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZ2V0RGVmYXVsdEV4cG9ydCBmdW5jdGlvbiBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIG5vbi1oYXJtb255IG1vZHVsZXNcbl9fd2VicGFja19yZXF1aXJlX18ubiA9IChtb2R1bGUpID0+IHtcblx0dmFyIGdldHRlciA9IG1vZHVsZSAmJiBtb2R1bGUuX19lc01vZHVsZSA/XG5cdFx0KCkgPT4gKG1vZHVsZVsnZGVmYXVsdCddKSA6XG5cdFx0KCkgPT4gKG1vZHVsZSk7XG5cdF9fd2VicGFja19yZXF1aXJlX18uZChnZXR0ZXIsIHsgYTogZ2V0dGVyIH0pO1xuXHRyZXR1cm4gZ2V0dGVyO1xufTsiLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLmcgPSAoZnVuY3Rpb24oKSB7XG5cdGlmICh0eXBlb2YgZ2xvYmFsVGhpcyA9PT0gJ29iamVjdCcpIHJldHVybiBnbG9iYWxUaGlzO1xuXHR0cnkge1xuXHRcdHJldHVybiB0aGlzIHx8IG5ldyBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cgPT09ICdvYmplY3QnKSByZXR1cm4gd2luZG93O1xuXHR9XG59KSgpOyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgbSBmcm9tIFwibWl0aHJpbFwiO1xuXG5pbXBvcnQgbW92aWVzIGZyb20gXCIuL3ZpZXcvbW92aWVzXCI7XG5pbXBvcnQgYXV0aCBmcm9tIFwiLi9tb2RlbHMvYXV0aC5qc1wiO1xuaW1wb3J0IGxvZ2luIGZyb20gXCIuL3ZpZXcvbG9naW4uanNcIjtcbmltcG9ydCBjb2NrdGFpbHMgZnJvbSBcIi4vdmlldy9jb2NrdGFpbHMuanNcIjtcbmltcG9ydCBmb29kcyBmcm9tIFwiLi92aWV3L2Zvb2QuanNcIjtcbmltcG9ydCBsYXlvdXQgZnJvbSBcIi4vdmlldy9sYXlvdXQuanNcIjtcbmltcG9ydCByZWdpc3RlciBmcm9tIFwiLi92aWV3L3JlZ2lzdGVyLmpzXCI7XG5cblxuLy8gV2FpdCBmb3IgdGhlIGRldmljZXJlYWR5IGV2ZW50IGJlZm9yZSB1c2luZyBhbnkgb2YgQ29yZG92YSdzIGRldmljZSBBUElzLlxuLy8gU2VlIGh0dHBzOi8vY29yZG92YS5hcGFjaGUub3JnL2RvY3MvZW4vbGF0ZXN0L2NvcmRvdmEvZXZlbnRzL2V2ZW50cy5odG1sI2RldmljZXJlYWR5XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VyZWFkeScsIG9uRGV2aWNlUmVhZHksIGZhbHNlKTtcblxuZnVuY3Rpb24gb25EZXZpY2VSZWFkeSgpIHtcbiAgICBtLnJvdXRlKGRvY3VtZW50LmJvZHksIFwiL1wiLCB7XG4gICAgICAgIFwiL1wiOiB7XG4gICAgICAgICAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtKGxheW91dCwgbShsb2dpbikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcIi9yZWdpc3RlclwiOiB7XG4gICAgICAgICAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtKGxheW91dCwgbShyZWdpc3RlcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcIi9tb3ZpZXNcIjoge1xuICAgICAgICAgICAgb25tYXRjaDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF1dGgudG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1vdmllcztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbS5yb3V0ZS5zZXQoXCIvbG9naW5cIik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVuZGVyOiBmdW5jdGlvbih2bm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtKGxheW91dCwgdm5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcIi9jb2NrdGFpbHNcIjoge1xuICAgICAgICAgICAgb25tYXRjaDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF1dGgudG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvY2t0YWlscztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbS5yb3V0ZS5zZXQoXCIvbG9naW5cIik7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVuZGVyOiBmdW5jdGlvbih2bm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtKGxheW91dCwgdm5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBcIi9mb29kc1wiOiB7XG4gICAgICAgICAgICBvbm1hdGNoOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXV0aC50b2tlbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm9vZHM7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG0ucm91dGUuc2V0KFwiL2xvZ2luXCIpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlbmRlcjogZnVuY3Rpb24odm5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbShsYXlvdXQsIHZub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICB9KTtcbn1cbiJdLCJzb3VyY2VSb290IjoiIn0=