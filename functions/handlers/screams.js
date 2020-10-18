const {db} = require('../util/admin');

exports.getAllScreams = (req,res) => {
    db
    .collection('screams')
    .orderBy('createAt', 'desc')
    .get()
    .then((data) =>{
        let screams = [];
        data.forEach((doc) =>{
            screams.push({
                screamId: doc.id,
                body:doc.data().body,
                userHandle: doc.data().userHandle,
                createAt: doc.data().createAt,
                commentCount: doc.data().commentCount,
                likeCount: doc.data().likeCount,
                userImage: doc.data().userImage,
                screamImageUrl: null
            });
        });
        return res.json(screams);
    })
    .catch(err=>{
        console.error(err);
        res.status(500).json({ error: err.code });
    });
}

exports.postOneScream = (req,res)=>{
    if (req.body.body.trim() === ''){
        return res.status(400).json({body: 'Body must not be empty'})
    }

    let noPicture = false
    if (noPicture){
    const newScream={
        body:req.body.body,
        userHandle:req.user.handle,
        userImage:req.user.imageUrl,
        screamImageUrl:null,
        createAt:new Date().toISOString(),
        likeCount:0,
        commentCount:0,
    };
    }
    else {
        const newScream={
            body:req.body.body,
            userHandle:req.user.handle,
            userImage:req.user.imageUrl,
            screamImageUrl:null,
            createAt:new Date().toISOString(),
            likeCount:0,
            commentCount:0,
        };
    }
    db.collection('screams').add(newScream).then((doc)=>{
        const resScream = newScream;
        resScream.screamId = doc.id;
        res.json(resScream)
        return null
    }).catch(err=>{
        res.status(500).json({error: 'something went wrong'});
        console.error(err);
    });
};


// Upload a image for scream
exports.lastImageUpload = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
  
    const busboy = new BusBoy({ headers: req.headers });
  
    let imageToBeUploaded = {};
    let imageFileName;
  
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(fieldname, file, filename, encoding, mimetype);
      if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
        return res.status(400).json({ error: 'Wrong file type submitted' });
      }
  
      // my.image.png => ['my', 'image', 'png']
      const imageExtension = filename.split('.').pop();
      // 32756238461724837.png
      imageFileName = `${Math.round(
        Math.random() * 1000000000000
      ).toString()}.${imageExtension}`;
      
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToBeUploaded = { filepath, mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });
  
    busboy.on('finish', () => {
      admin.storage().bucket(config.storageBucket).upload(imageToBeUploaded.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageToBeUploaded.mimetype
            }
          }
        })
        .then(() => {
          const lastImageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
          return db.doc(`/screams/${req.scream.handle}`).update({ lastImageUrl });
        })
        .then(() => {
          return res.json({ message: 'image uploaded successfully' });
        })
        .catch((err) => {
          console.error(err);
          return res.status(500).json({ error: 'something went wrong' });
        });
    });
    busboy.end(req.rawBody);
  };

exports.getScream = (req,res)=>{
    let screamData ={};
    db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc=>{
        if(!doc.exists){
            return res.status(404).json({error: 'Scream not found'})
        }
        screamData = doc.data();
        screamData.screamId=doc.id;
        return db
        .collection('comments')
        .orderBy('createAt','desc')
        .where('screamId','==',req.params.screamId)
        .get();
    })
    .then(data=>{
        screamData.comments =[];
        data.forEach(doc=>{
            screamData.comments.push(doc.data())
        });
        return res.json(screamData);
    })
    .catch(err=>{
        console.error(err);
        res.status(500).json({error:err.code});
    })
}


// Comment on a comment
exports.commentOnScream = (req,res)=>{
    if(req.body.body.trim() ==='')
        return res.status(400).json({comment:'Must not be empty'});

        const newComment = {
            body:req.body.body,
            createAt: new Date().toISOString(),
            screamId: req.params.screamId,
            userHandle: req.user.handle,
            userImage: req.user.imageUrl,
            screamImageUrl: null
        };
    
        db.doc(`/screams/${req.params.screamId}`)
        .get()
        .then(doc =>{
            if(!doc.exists){
                return res.status(404).json({error: 'Scream not found'});
            }

            return doc.ref.update({commentCount: doc.data().commentCount +1});
        })
        .then(()=>{
            return db.collection('comments').add(newComment);
        })
        .then(()=>{
                res.json(newComment);
                return null
            })
            .catch((err)=>{
                console.log(err);
                res.status(500).json({error: 'Something went wrong'});
            });
}

// Like a scream 
exports.likeScream = (req,res)=>{
    const likeDocument = db
    .collection('likes')
    .where('userHandle','==',req.user.handle)
    .where('screamId','==',req.params.screamId)
    .limit(1)

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;

    screamDocument
    .get()
    .then(doc=>{
        if(doc.exists){
            screamData=doc.data();
            screamData.screamId=doc.id;
            return likeDocument.get();
        }
        else {
            return res.status(404).json({error:'Scream not found'});
        }
    })
    .then(data=>{
        if(data.empty){
            return db.collection('likes')
            .add({
                screamId:req.params.screamId,
                userHandle:req.user.handle
            })
            .then(()=>{
                screamData.likeCount ++;
                return screamDocument.update({likeCount:screamData.likeCount});
            })
            .then(()=>{
                return res.json(screamData);
            });
        }else {return res.status(400).json({error: 'Scream already liked'});}

    })
    .catch(err=>{
        console.error(err);
        res.status(500).json({error:err.code})
    })
}

// Unlike a Scream
exports.unlikeScream = (req,res)=>{
    const likeDocument = db
    .collection('likes')
    .where('userHandle','==',req.user.handle)
    .where('screamId','==',req.params.screamId)
    .limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;

    screamDocument.get()
    .then(doc=>{
        if(doc.exists){
            screamData=doc.data();
            screamData.screamId=doc.id;
            return likeDocument.get();
        }
        else {
            return res.status(404).json({error:'Scream not found'});
        }
    })
    .then(data=>{
        if(data.empty){
            return res.status(400).json({error: 'Scream not liked'});

        }else{
            return db
            .doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(()=>{
                screamData.likeCount--;
                return screamDocument.update({likeCount:screamData.likeCount})
            }
            )
            .then(()=>{
                return res.json(screamData);
            }
            );
        }
    })
    .catch(err=>{
        console.error(err);
        res.status(500).json({error:err.code})
    })
};

// Delete a scream
exports.deleteScream = (req, res) => {
  const document = db.doc(`/screams/${req.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Scream not found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return (res.status(403).json({ error: 'Unauthorized' }));
      } else {
        return (document.delete());
      }
    })
    .then(() => {
      return res.json({ message: 'Scream deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};