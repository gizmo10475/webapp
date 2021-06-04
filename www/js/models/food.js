import m from "mithril";


let foodModel = {
    current: {},
    getFood: function() {
        m.request({
            url: `https://www.themealdb.com/api/json/v1/1/random.php`,
            method: "GET",
        }).then(function(result) {
            // console.log(result.drinks[0]);
            foodModel.current = result.meals[0];
            console.log(foodModel.current);
        });
    }
};

export default foodModel;
