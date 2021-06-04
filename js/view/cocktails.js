import m from "mithril";

import cocktailsModel from "../models/cocktails.js";

let cocktails = {
    oninit: cocktailsModel.getCocktail,
    view: function() {
        return [
            m("h1.center", "What cocktail should I make?"),
            m("form", {
                onsubmit: function () {
                    cocktailsModel.getCocktail();
                }
            },
            m("br"),
            m("p.center", "You should make a.."),
            m("br"),
            m("h3.center", m("b", cocktailsModel.current.strDrink)),
            m("br"),
            m("img", {
                "class":"movieImg",
                "src":cocktailsModel.current.strDrinkThumb
            }),
            m("br"),
            m("button.buttonCenter", "Next cocktail"),
            m("br"),
            m("br"),
            m("h1.center", "Cocktail-info"),
            m("br"),
            m("div.infoDiv",
                m("p.center", m("b",
                    cocktailsModel.current.strAlcoholic + " beverage"
                )),
                m("br"),
                m("p.center", cocktailsModel.current.strMeasure1, " ", cocktailsModel.current.strIngredient1),
                m("p.center", cocktailsModel.current.strMeasure2, " ", cocktailsModel.current.strIngredient2),
                m("p.center", cocktailsModel.current.strMeasure3, " ", cocktailsModel.current.strIngredient3),
                m("p.center", cocktailsModel.current.strMeasure4, " ", cocktailsModel.current.strIngredient4),
                m("p.center", cocktailsModel.current.strMeasure5, " ", cocktailsModel.current.strIngredient5),
                m("p.center", cocktailsModel.current.strMeasure6, " ", cocktailsModel.current.strIngredient6),
                m("p.center", cocktailsModel.current.strMeasure7, " ", cocktailsModel.current.strIngredient7),
                m("p.center", cocktailsModel.current.strMeasure8, " ", cocktailsModel.current.strIngredient8),
                m("p.center", cocktailsModel.current.strMeasure9, " ", cocktailsModel.current.strIngredient9),
                m("p.center", cocktailsModel.current.strMeasure10, " ", cocktailsModel.current.strIngredient10),
                m("p.center", cocktailsModel.current.strMeasure11, " ", cocktailsModel.current.strIngredient11),
                m("p.center", cocktailsModel.current.strMeasure12, " ", cocktailsModel.current.strIngredient12),
                m("p.center", cocktailsModel.current.strMeasure13, " ", cocktailsModel.current.strIngredient13),
                m("p.center", cocktailsModel.current.strMeasure14, " ", cocktailsModel.current.strIngredient14),
                m("p.center", cocktailsModel.current.strMeasure15, " ", cocktailsModel.current.strIngredient15),
                m("br"),
                m("p.center",
                    cocktailsModel.current.strInstructions
                ),
                m("br"),
            )
            )
            ];
    }
};

export default cocktails;
