import path from 'path';
import _ from 'lodash';
import { ObjectID } from 'mongodb';
import { version } from '../package.json';
import File from './models/file';
import Post from './models/post';
import FileArchiver from './archiver';
import Email from './email';
import S3 from './s3';

class AppRouter {
  constructor(app) {
    this.app = app;
    this.setupRouters();
  }


  setupRouters() {
    const app = this.app;
    const db = app.get('db');
    const uploadDir = app.get('storageDir');
    const upload = app.upload;

    // root routing.
    app.get('/', (req, res, next) => res.status(200).json({
      version,
    }));

    // Upload routing
    app.post('/api/upload', upload.array('files'), (req, res, next) => {
      const files = _.get(req, 'files', []);

      const fileModels = [];


      _.each(files, (fileObject) => {
        const newFile = new File(app).initWithObject(fileObject).toJSON();
        fileModels.push(newFile);
      });


      if (fileModels.length) {
        db.collection('files').insertMany(fileModels, (err, result) => {
          if (err) {
            return res.status(503).json({
              error: {
                message: 'Unable saved your files.',
              },
            });
          }


          const post = new Post(app).initWithObject({

            from: _.get(req, 'body.from'),
            to: _.get(req, 'body.to'),
            message: _.get(req, 'body.message'),
            files: result.insertedIds,
          }).toJSON();


          // let save post object to posts collection.
          db.collection('posts').insertOne(post, (err, result) => {
            if (err) {
              return res.status(503).json({ error: { message: 'Your upload could not be saved.' } });
            }

            // Implement email sending to user with download link
            // send email
            const sendEmail = new Email(app);
            sendEmail.sendDownloadLink(post, (err, info) => {
              if (err) {
                console.log('Error sending email notify downloadl link');
              } else {
                console.log('Email info: ', info);
              }
            });

            return res.json(post);
          });
        });
      } else {
        return res.status(503).json({
          error: { message: 'Files upload is required.' },
        });
      }
    });

    // Download routing

    app.get('/api/download/:id', (req, res, next) => {
      const fileId = req.params.id;
      db.collection('files').find({ _id: ObjectID(fileId) }).toArray((err, result) => {
        const fileName = _.get(result, '[0].name');
        if (err || !fileName) {
          return res.status(404).json({
            error: {
              message: 'File not found.',
            },
          });
        }

        // Download file from S3 service
        const file = _.get(result, '[0]');
        const downloader = new S3(app, res);

        return downloader.download(file);

        /* const filePath = path.join(uploadDir, fileName);

         return res.download(filePath, _.get(result, '[0].originalName'), (err) => {
           if (err) {
             return res.status(404).json({

               error: {
                 message: 'File not found',
               },
             });
           }
         }); */
      });
    });


    // routing for post detail /api/posts/:id

    app.get('/api/posts/:id', (req, res, next) => {
      const postId = _.get(req, 'params.id');
      let postObjectId = null;
      try {
        postObjectId = new ObjectID(postId);
      } catch (err) {
        return res.status(404).json({ error: { message: 'File not found.' } });
      }

      db.collection('posts').find({ _id: postObjectId }).limit(1).toArray((err, results) => {
        const result = _.get(results, '[0]');

        if (err || !result) {
          return res.status(404).json({ error: { message: 'File not found.' } });
        }

        const fileIds = _.get(result, 'files', []);

        db.collection('files').find({ _id: { $in: fileIds } }).toArray((err, files) => {
          if (err || !files || !files.length) {
            return res.status(404).json({ error: { message: 'File not found.' } });
          }

          result.files = files;

          return res.json(result);
        });
      });
    });

    // Routing download zip files.
    app.get('/api/posts/:id/download', (req, res, next) => {
      const id = _.get(req, 'params.id', null);


      this.getPostById(id, (err, result) => {
        if (err) {
          return res.status(404).json({ error: { message: 'File not found.' } });
        }

        const files = _.get(result, 'files', []);
        const archiver = new FileArchiver(app, files, res).download();
        return archiver;
      });
    });
  }

  getPostById(id, callback = () => { }) {
    const app = this.app;

    const db = app.get('db');


    let postObjectId = null;
    try {
      postObjectId = new ObjectID(id);
    } catch (err) {
      return callback(err, null);
    }

    db.collection('posts').find({ _id: postObjectId }).limit(1).toArray((err, results) => {
      const result = _.get(results, '[0]');

      if (err || !result) {
        return callback(err || new Error('File not found.'));
      }

      const fileIds = _.get(result, 'files', []);

      db.collection('files').find({ _id: { $in: fileIds } }).toArray((err, files) => {
        if (err || !files || !files.length) {
          return callback(err || new Error('File not found.'));
        }

        result.files = files;


        return callback(null, result);
      });
    });
  }
}


export default AppRouter;
