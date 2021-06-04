import m from "mithril";

import movies from "./view/movies";
import auth from "./models/auth.js";
import login from "./view/login.js";
import cocktails from "./view/cocktails.js";
import foods from "./view/food.js";
import layout from "./view/layout.js";
import register from "./view/register.js";


// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    m.route(document.body, "/", {
        "/": {
            render: function() {
                return m(layout, m(login));
            }
        },
        "/register": {
            render: function() {
                return m(layout, m(register));
            }
        },
        "/movies": {
            onmatch: function() {
                if (auth.token) {
                    return movies;
                }

                return m.route.set("/login");
            },
            render: function(vnode) {
                return m(layout, vnode);
            }
        },
        "/cocktails": {
            onmatch: function() {
                if (auth.token) {
                    return cocktails;
                }

                return m.route.set("/login");
            },
            render: function(vnode) {
                return m(layout, vnode);
            }
        },
        "/foods": {
            onmatch: function() {
                if (auth.token) {
                    return foods;
                }

                return m.route.set("/login");
            },
            render: function(vnode) {
                return m(layout, vnode);
            }
        },
    });
}
