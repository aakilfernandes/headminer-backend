console.log('run-jobs')

const JobQueue = require('../lib/JobQueue')
const get_reddit_posts_job = require('../jobs/getRedditPosts')

const job_queue = new JobQueue()

job_queue.addJob(get_reddit_posts_job)
setInterval(() => {
  job_queue.addJob(get_reddit_posts_job)
}, 10000)

job_queue.runJobs()
