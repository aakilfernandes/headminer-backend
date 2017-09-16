const restify = require('restify')
const mysqlQuery = require('./lib/mysqlQuery')
const _ = require('lodash')
const getQs = require('./lib/getQs')

const server = restify.createServer({
  name: 'headminer',
  version: '1.0.0'
})

function getArticles(_tables_query, _where_query, values) {
  const tables_query = _tables_query ? `, ${_tables_query}` : ''
  const where_query = _where_query ? `AND ${_where_query}` : ''
  return mysqlQuery(`
    SELECT
        articles.*,
        urls.url,
        publishers.id AS publisher_id,
        publishers.name AS publisher_name
      FROM articles, urls, domains, publishers${tables_query}
      WHERE articles.id = urls.article_id
        AND urls.id = urls.canonical_url_id
        AND urls.domain_id = domains.id
        AND domains.publisher_id = publishers.id
        ${where_query}
      ORDER BY heat DESC
      LIMIT 10;
  `, values).then((_articles) => {

    const articles = _.uniqBy(_articles, 'id')
    // edge cases where 2 canonical urls ie bbc.com and bbc.co.uk

    if (articles.length === 0) {
      return articles
    }

    articles.forEach((article) => {
      article.snapshots = []
      article.twitter_influencers = []
    })

    const articles_by_id = _.keyBy(articles, 'id')

    const article_ids = _.map(articles, 'id')
    const article_ids_qs = getQs(article_ids.length)

    return mysqlQuery(`
      SELECT * FROM article_snapshots
        WHERE article_id IN (${article_ids_qs})
        ORDER BY created_at ASC;
      SELECT
          twitter_influencers.*, twitter_articles_influences.article_id,
          twitter_articles_influences.influence,
          twitter_articles_influences.adjusted_influence
        FROM twitter_influencers, twitter_articles_influences
        WHERE twitter_articles_influences.article_id IN (${article_ids_qs})
          AND twitter_influencers.id = twitter_articles_influences.influencer_id
          AND twitter_influencers.is_ignored = 0
        ORDER BY twitter_articles_influences.adjusted_influence DESC;
    `, article_ids.concat(article_ids)).then((results) => {
      const snapshots = results[0]
      const twitter_influencers = results[1]

      snapshots.forEach((snapshot) => {
        articles_by_id[snapshot.article_id].snapshots.push(snapshot)
      })

      twitter_influencers.forEach((twitter_influencer) => {
        articles_by_id[twitter_influencer.article_id].twitter_influencers.push(twitter_influencer)
      })

      return articles
    })

  })
}

server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())
server.use(function crossOrigin(req,res,next){
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  return next()
})

server.get('/hot/', function (req, res, next) {
  getArticles().then((articles) => {
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

server.get('/publishers/:id/articles', function (req, res, next) {
  getArticles(null, 'publishers.id = ?', [req.params.id]).then((articles) => {
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

server.get('/twitter-influencers/:id/high-influence-articles', (req, res, next) => {
  getArticles('twitter_articles_influences', `
      articles.id = twitter_articles_influences.article_id
      AND twitter_articles_influences.adjusted_influence >= 1
      AND twitter_articles_influences.influencer_id = ?
  `, [req.params.id]).then((articles) => {
    res.send(articles)
    next()
  })
})

server.get('/twitter-influencers/:id/low-influence-articles', (req, res, next) => {
  getArticles('twitter_articles_influences', `
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
