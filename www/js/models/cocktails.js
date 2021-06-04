import m from "mithril";


let cocktailsModel = {
    current: {},
    getCocktail: function() {
        m.request({
            url: `https://www.thecocktaildb.com/api/json/v1/1/random.php`,
            method: "GET",
        }).then(function(result) {
            // console.log(result.drinks[0]);
            cocktailsModel.current = result.drinks[0];
            console.log(cocktailsModel.current);
        });
    }
};

export default cocktailsModel;
