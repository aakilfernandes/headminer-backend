const restify = require('restify')
const connection = require('./lib/connection')
const _ = require('lodash')

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

server.get('/articles/:id', function (req, res, next) {
  connection.query('SELECT * FROM articles WHERE id = ?', [req.params.id]).then((articles) => {
    const article = articles[0]
    return connection.query('SELECT * FROM urls WHERE article_id = ?', [article.id]).then((urls) => {
      article.urls = urls
      article.url = _.find(urls, (url) => {
        return url.id === url.canonical_url_id
      })
      return connection.query('SELECT * FROM domains WHERE id = ?', [article.url.domain_id]).then((domains) => {
        const domain = domains[0]
        article.url.domain = domain
      })
    }).then(() => {
      return connection.query(`
        SELECT
          twitter_influencers.*,
          twitter_articles_influences.influence,
          twitter_articles_influences.adjusted_influence
        FROM twitter_influencers, twitter_articles_influences
        WHERE
          twitter_articles_influences.article_id = ?
          AND twitter_influencers.id = twitter_articles_influences.influencer_id
          AND twitter_influencers.is_ignored = 0
        ORDER BY twitter_articles_influences.adjusted_influence DESC
      `, [article.id]).then((influencers) => {
        article.influencers = influencers
        res.send(article)
        next()
      })
    })
  })
})

server.get('/hot/', function (req, res, next) {
  connection.query('SELECT id FROM articles ORDER BY heat DESC LIMIT 10', []).then((articles) => {
    const ids = articles.map((article) => {
      return article.id
    })
    res.send(ids)
  })
})

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
