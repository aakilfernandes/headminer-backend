const restify = require('restify')
const mysqlQuery = require('./lib/mysqlQuery')
const _ = require('lodash')
const getQs = require('./lib/getQs')
const getArticles = require('./lib/getArticles')
const incrementArticlesPriorities = require('./lib/incrementArticlesPriorities')
const Promise = require('bluebird')
const restifyPromise = require('restify-await-promise')
const endpoints = require('./lib/endpoints')
const fs = require('./lib/fs')

Date.prototype.toJSON = function toJSON(){
   return this.getTime()
}

const server = restify.createServer({
  name: 'headminer',
  version: '1.0.0'
})

restifyPromise.install(server, {
  logger: console
})

server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())
server.use(function crossOrigin(req,res,next){
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  return next()
})

_.map(endpoints, (endpoint, url) => {
  server.get(endpoint.pattern, (request, response) => {
    if (endpoint.cache_ms === 0) {
      return endpoint.handle(request.params)
    }

    const cache_path = endpoint.getCachePath(request.params)

    return fs.readFileAsync(cache_path, 'utf8').then((cached_json) => {
      const cached = JSON.parse(cached_json)
      if (Number.isNaN(endpoint.cache_ms)) {
        return cached.value
      }
      if (Date.now() - cached.cached_at < endpoint.cache_ms) {
        return cached.value
      }
      return endpoint.handleAndCache(request.params)
    }, () => {
      return endpoint.handleAndCache(request.params)
    }).then((value) => {
      if (endpoint.postHandle) {
        console.log('endpoint.postHandle')
        return endpoint.postHandle(value).then(() => {
          return value
        })
      }
      return value
    })
  })
})

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
