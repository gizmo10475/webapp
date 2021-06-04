"use strict";

import m from 'mithril';
import auth from '../models/auth.js';

let layout = {
    view: function(vnode) {
        if (auth.token.length > 20) {
            return m("main", [
                m("navbar.navbar", [
                    m("div.container", [
                        m("ul.nav", [
                            m("li", [
                                m("a", {
                                    href: "#!/movies" }, "Movies")
                            ]),
                            m("li", [
                                m("a", {
                                    href: "#!/cocktails" }, "Cocktails")
                            ]),
                            m("li", [
                                m("a", {
                                    href: "#!/foods" }, "Foods")
                            ])

                        ])
                    ])
                ]),
                m("section.container", vnode.children)
            ]);
        } else {
            return m("main", [
                m("navbar.navbar", [
                    m("div.container", [
                        m("ul.nav", [
                            m("li", [
                                m("a", {
                                    href: "#!/login" }, "Login")
                            ])
                        ])
                    ])
                ]),
                m("section.container", vnode.children)
            ]);
        }
    }
};

export default layout;
