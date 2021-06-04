import m from "mithril";
import regi from "../models/regi";


let register = {
    view: function() {
        return [
            m("h1", "Register account"),
            m("form", {
                onsubmit: function () {
                    regi.register();
                }
            },
            m("label.input-label", "E-mail"),
            m("input[type=email].input", {
                oninput: function (event) {
                    regi.email = event.target.value;
                },
                value: regi.email
            }),
            m("label.input-label", "Password"),
            m("input[type=password].input", {
                oninput: function (event) {
                    regi.password = event.target.value;
                },
                value: regi.password
            }),
            m("input[type=submit][value=Registrera].button", "Registrera")
            )
        ];
    }
};

export default register;
