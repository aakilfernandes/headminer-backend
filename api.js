const restify = require('restify')
const mysqlQuery = require('./lib/mysqlQuery')
const _ = require('lodash')
const getQs = require('./lib/getQs')
const getArticles = require('./lib/getArticles')

const server = restify.createServer({
  name: 'headminer',
  version: '1.0.0'
})

server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())
server.use(function crossOrigin(req,res,next){
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  return next()
})

server.get('/hot/:page_index', function (req, res, next) {
  getArticles(req.params.page_index).then((articles) => {
    res.send(articles)
    next()
  })
})

server.get('/jobs/', function (req, res, next) {
  mysqlQuery('SELECT * FROM jobs ORDER BY id DESC LIMIT 1000', []).then((jobs) => {
    res.send(jobs)
    next()
  })
})

server.get('/publishers/:id', function (req, res, next) {
  mysqlQuery(`
    SELECT * FROM publishers WHERE id = ?;
  `, [req.params.id]).then((publishers) => {
    res.send(publishers[0])
    next()
  })
})

server.get('/publishers/:id/articles/:page_index', function (req, res, next) {
  getArticles(req.params.page_index, null, 'publishers.id = ?', [req.params.id]).then((articles) => {
    res.send(articles)
    next()
  })
})

server.get('/twitter-influencers/:id', function (req, res, next) {
  console.log(req.params.id)
  mysqlQuery('SELECT * FROM twitter_influencers WHERE id = ?', [req.params.id]).then((influencers) => {
    res.send(influencers[0])
    next()
  })
})

server.get('/twitter-influencers/:id/high-influence-articles/:page_index', (req, res, next) => {
  getArticles(req.params.page_index, 'twitter_articles_influences', `
      articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence >= 1
      AND twitter_articles_influences.influencer_id = ?
  `, [req.params.id]).then((articles) => {
    res.send(articles)
    next()
  })
})

server.get('/twitter-influencers/:id/low-influence-articles/:page_index', (req, res, next) => {
  getArticles(req.params.page_index, 'twitter_articles_influences', `
      articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence <= -1
      AND twitter_articles_influences.influencer_id = ?
  `, [req.params.id]).then((articles) => {
    res.send(articles)
    next()
  })
})

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
