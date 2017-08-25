const restify = require('restify')
const connection = require('./lib/connection')

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
    return connection.query('SELECT * FROM urls WHERE id = ?', [article.url_id]).then((urls) => {
      const url = urls[0]
      article.url = url
      return connection.query('SELECT * FROM domains WHERE id = ?', [article.url.domain_id]).then((domains) => {
        const domain = domains[0]
        article.url.domain = domain
        res.send(article)
        next()
      })
    })
  })
})

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
