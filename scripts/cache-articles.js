const endpoints = require('../lib/endpoints')
const _ = require('lodash')
const fs = require('../lib/fs')
const getCachePath = require('../lib/getCachePath')
const waterfall = require('promise-waterfall')
const mysqlDisconnect = require('../lib/mysqlDisconnect')

Date.prototype.toJSON = function toJSON() {
  return this.getTime()
}

const cacheArticles = _.range(10).map((page_index) => {
  return () => {
    console.log(page_index)
    return endpoints.articles.handleAndCache({ page_index })
  }
})

waterfall(cacheArticles).finally(() => {
  return mysqlDisconnect()
})
