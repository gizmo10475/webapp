import m from "mithril";


let auth = {
    url: "https://lager.emilfolino.se/v2/auth/login",
    email: "",
    password: "",
    token: "",

    login: function() {
        m.request({
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
            return m.route.set("/");
        });
    }
};

export default auth;
