import m from "mithril";
import Movies from './links/links.json';


let moviesModel = {
    url: "http://www.omdbapi.com/",
    current: {},
    getMovies: function() {
        var randomNumber = Movies.Movies[Math.floor(Math.random() * 8000)];

        m.request({
            url: `${moviesModel.url}?apikey=55623944&i=tt${randomNumber}&plot=full`,
            method: "GET",
        }).then(function(result) {
            moviesModel.current = result;
        });
    }
};

export default moviesModel;
