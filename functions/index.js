const functions = require('firebase-functions');
const express = require('express');
const app = express();

const cors =require('cors');
app.use(cors());

const {db}=require('./util/admin');

const FBAuth = require('./util/fbAuth');

const {getAllScreams, 
        postOneScream,
        getScream,
        commentOnScream,
        likeScream,
        unlikeScream,
        deleteScream,
        // lastImageUpload
        
    }= require('./handlers/screams');
const {
    signup,
    login,
    uploadImage,
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
    

}= require('./handlers/users');

// Scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth ,postOneScream);
app.get('/scream/:screamId',getScream);
app.delete('/scream/:screamId',FBAuth, deleteScream);
app.get('/scream/:screamId/like',FBAuth,likeScream);
app.get('/scream/:screamId/unlike',FBAuth,unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);
// app.post('/scream/image',FBAuth,lastImageUpload);

// Users routes
app.post('/signup',signup);
app.post('/login', login);
app.post('/user/image',FBAuth,uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user',FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);





// https://baseurl.com/api/

exports.api = functions.region('asia-east2').https.onRequest(app);

// CreateNotification on 'Like'
exports.createNotificationOnLike = functions
  .region('asia-east2')
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if(
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
          });
        }
        return null
      })
      .catch((err) => console.error(err));
  });

// DeleteNotification on 'Unlike'
exports.deleteNotificationOnUnLike = functions
  .region('asia-east2')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

// CreateNotification on 'Conmment'
exports.createNotificationOnComment = functions
  .region('asia-east2')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          });
        }
        return null
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

  // Image of User change
  exports.onUserImageChange=functions.region('asia-east2').firestore.document('/users/{userId}')
    .onUpdate((change)=>{
      console.log(change.before.data());
      console.log(change.after.data());
      if(change.before.data().imageUrl !== change.after.data().imageUrl){
        console.log('image has changed');
        let batch = db.batch();
        return db.collection('screams').where('userHandle','==',change.before.data().handle).get()
        .then((data)=>{
            data.forEach(doc=>{
              const scream = db.cod(`/screams/${doc.id}`);
              batch.update(scream,{userImage: change.after.data().imageUrl});
            })
            return batch.commit();
        });
      }else return true;
    })

    exports.onScreamDelete = functions
      .region('asia-east2')
      .firestore.document('/screams/{screamId}')
      .onDelete((snapshot,context)=>{
        const screamId = context.params.screamId;
        const batch = db.batch();
        return db
          .collection('comments')
          .where('screamId','==', screamId)
          .get()
          .then((data)=>{
            data.forEach((doc)=>{
              batch.delete(db.doc(`/comments/${doc.id}`));
            });
            return db.collection('likes').where('screamId','==',screamId).get();
          })
          .then((data)=>{
            data.forEach((doc)=>{
              batch.delete(db.doc(`/notifications/${doc.id}`));
            });
            return db.collection('likes').where('screamId','==',screamId).get();
          })
          .then((data)=>{
            data.forEach((doc)=>{
              batch.delete(db.doc(`/notifications/${doc.id}`));
            })
            return batch.commit();
          })
          .catch((err)=> console.error(err))
      })