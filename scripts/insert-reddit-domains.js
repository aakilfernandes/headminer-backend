const fs = require('fs')
const connection = require('../lib/connection')

const reddit_domains_file = fs.readFileSync(`${__dirname}/../redditDomains.json`, 'utf8')
const reddit_domains = JSON.parse(reddit_domains_file)

reddit_domains.slice(0, 1000).forEach((reddit_domain) => {
  connection.query(`INSERT IGNORE into publisher_hostnames(publisher_id, hostname) VALUES(0, ?)`, [
    reddit_domain.domain
  ])
})


console.log(reddit_domains)
