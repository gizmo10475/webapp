import m from "mithril";


let regi = {
    url: "https://lager.emilfolino.se/v2/auth/register",
    email: "",
    password: "",
    token: "",

    register: function() {
        m.request({
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
            return m.route.set("/");
        });
    }
};

export default regi;
