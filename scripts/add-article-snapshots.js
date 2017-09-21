const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')

mysqlQuery(`
  INSERT INTO article_snapshots(article_id, heat, reddit_posts_count, reddit_score, twitter_statuses_count, facebook_share_count, facebook_comment_count)
  SELECT id, heat, reddit_posts_count, reddit_score, twitter_statuses_count, facebook_share_count, facebook_comment_count
    FROM articles
    WHERE created_at > NOW() - INTERVAL 48 HOUR
    	AND heatified_at IS NOT NULL
`).finally(() => {
  return mysqlDisconnect()
})
