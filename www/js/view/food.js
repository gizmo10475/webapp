import m from "mithril";

import foodModel from "../models/food.js";

let foods = {
    oninit: foodModel.getFood,
    view: function() {
        return [
            m("h1.center", "What food should I make?"),
            m("form", {
                onsubmit: function () {
                    foodModel.getFood();
                }
            },
            m("br"),
            m("p.center", "You should cook.."),
            m("br"),
            m("h3.center", m("b", foodModel.current.strMeal)),
            m("br"),
            m("img", {
                "class": "movieImg",
                "src": foodModel.current.strMealThumb
            }),
            m("br"),
            m("button.buttonCenter", "Next recipe"),
            m("br"),
            m("br"),
            m("h1.center", "Food-info"),
            m("br"),
            m("div.infoDiv",
                m("p.center", m("b",
                    foodModel.current.strCategory
                )),
                m("br"),
                m("p.center", foodModel.current.strMeasure1, " ",
                    foodModel.current.strIngredient1),
                m("p.center", foodModel.current.strMeasure2, " ",
                    foodModel.current.strIngredient2),
                m("p.center", foodModel.current.strMeasure3, " ",
                    foodModel.current.strIngredient3),
                m("p.center", foodModel.current.strMeasure4, " ",
                    foodModel.current.strIngredient4),
                m("p.center", foodModel.current.strMeasure5, " ",
                    foodModel.current.strIngredient5),
                m("p.center", foodModel.current.strMeasure6, " ",
                    foodModel.current.strIngredient6),
                m("p.center", foodModel.current.strMeasure7, " ",
                    foodModel.current.strIngredient7),
                m("p.center", foodModel.current.strMeasure8, " ",
                    foodModel.current.strIngredient8),
                m("p.center", foodModel.current.strMeasure9, " ",
                    foodModel.current.strIngredient9),
                m("p.center", foodModel.current.strMeasure10, " ",
                    foodModel.current.strIngredient10),
                m("p.center", foodModel.current.strMeasure11, " ",
                    foodModel.current.strIngredient11),
                m("p.center", foodModel.current.strMeasure12, " ",
                    foodModel.current.strIngredient12),
                m("p.center", foodModel.current.strMeasure13, " ",
                    foodModel.current.strIngredient13),
                m("p.center", foodModel.current.strMeasure14, " ",
                    foodModel.current.strIngredient14),
                m("p.center", foodModel.current.strMeasure15, " ",
                    foodModel.current.strIngredient15),
                m("p.center", foodModel.current.strMeasure16, " ",
                    foodModel.current.strIngredient16),
                m("p.center", foodModel.current.strMeasure17, " ",
                    foodModel.current.strIngredient17),
                m("p.center", foodModel.current.strMeasure18, " ",
                    foodModel.current.strIngredient18),
                m("p.center", foodModel.current.strMeasure19, " ",
                    foodModel.current.strIngredient19),
                m("p.center", foodModel.current.strMeasure20, " ",
                    foodModel.current.strIngredient20),
                m("br"),
                m("p.center",
                    foodModel.current.strInstructions
                ),
                m("br"),
            )
            )
        ];
    }
};

export default foods;
