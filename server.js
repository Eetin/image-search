var request = require('request')
var mongoose = require('mongoose')
var express = require('express')
var path = require('path')

var app = express()

mongoose.Promise = global.Promise
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/imagesearch')

var Schema = mongoose.Schema
    
var searchSchema = new Schema({
    search: { type: String, required: true },
    offset: { type: Number },
    date  : { type: Date, default: Date.now }
}, {
    capped: { size: 1000000, max: 10 }
})

var Search = mongoose.model('Search', searchSchema)

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(express.static('public'))

app.get('/', function(req, res) {
    res.render('index', { appUrl: `${req.protocol}://${req.hostname}/` })
})

app.get('/search/:query', function(req, res) {
    var requestUrl = buildGoogleSearchUrl(req.params.query, req.query.offset) 
    request(requestUrl, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            var search = new Search({ search: req.params.query })
            if (req.query.offset) search.offset = +req.query.offset
            search.save()
            var data = JSON.parse(body).items
            var results = data.map(function(d) {
                return {
                    image_url    : d.link,
                    alt_text     : d.snippet,
                    thumbnail_url: d.image.thumbnailLink,
                    page_url     : d.image.contextLink
                }
            })
            res.json(results)
        } else {
            res.json({ error: 'Could not connect to external API. Try again later' })
        }
    })
})

app.get('/history', function(req, res) {
    Search.find({}, { '_id': 0 })
        .sort('-date')
        .select('search offset date')
        .exec(function(err, results) {
        if (err) return res.json({ error: 'Could not get recent search queries' })
        res.json(results);
    })
})

app.listen(process.env.PORT || 8080)

function buildGoogleSearchUrl(query, offset) {
    var url = 'https://www.googleapis.com/customsearch/v1'
    url += '?q=' + query
    url += offset ? '&start=' + (+offset + 1) : ''
    url += '&cx=' + process.env.SEARCH_ID
    url += '&searchType=image'
    url += '&key=' + process.env.GOOGLE_API_KEY
    return url
}
