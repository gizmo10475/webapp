import m from "mithril";

import movieModel from "../models/movies.js";

let movies = {
    oninit: movieModel.getMovies,
    view: function() {
        return [
            m("h1.center", "What movie should I watch?"),
            m("form", {
                onsubmit: function () {
                    movieModel.getMovies();
                }
            },
            m("br"),
            m("p.center", "You should watch.."),
            m("br"),
            m("h3.center", m("b", movieModel.current.Title)),
            m("br"),
            m("img", {
                "class": "movieImg",
                "src": movieModel.current.Poster
            }),
            m("br"),
            m("button.buttonCenter", "Next movie"),
            m("br"),
            m("br"),
            m("h1.center", "Movie-info"),
            m("br"),
            m("div.infoDiv",
                m("p.center", m("b",
                    movieModel.current.Year
                )),
                m("br"),
                m("p.center",
                    movieModel.current.Language
                ),
                m("br"),
                m("p.center", m("b", "Actors"), m("br"),
                    movieModel.current.Actors
                ),
                m("br"),
                m("p.center",
                    movieModel.current.Plot
                ),
                m("br"),
                m("p.center", m("b",
                    "IMDB RATING " + movieModel.current.imdbRating
                )
                ),
                m("br"),
            )
            )
        ];
    }
};

export default movies;
