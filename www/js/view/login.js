import m from "mithril";
import auth from "../models/auth";


let login = {
    view: function() {
        return [
            m("h1.center", "Welcome to Eddies project!!"),
            m("p.center", "Login to continue."),

            m("p.center",
                [
                    "No account? ",
                    m("a", {href: "#!/register"},
                        "Register here!"
                    )
                ]
            ),
            m("form", {
                onsubmit: function () {
                    auth.login();
                }
            },
            m("label.input-label", "E-mail"),
            m("input[type=email].input", {
                oninput: function (event) {
                    auth.email = event.target.value;
                },
                value: auth.email
            }),
            m("label.input-label", "Password"),
            m("input[type=password].input", {
                oninput: function (event) {
                    auth.password = event.target.value;
                },
                value: auth.password
            }),
            m("input[type=submit][value=Log in].buttonCenter", "Log in")
            )
        ];
    }
};

export default login;
