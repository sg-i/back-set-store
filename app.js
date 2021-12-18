require('dotenv').config();
const express = require('express');
var cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const session = require('express-session');
var passport = require('passport');
var crypto = require('crypto');
var LocalStrategy = require('passport-local').Strategy;
const MongoStore = require('connect-mongo')(session);

//-------------- GENERAL SETUP ----------------
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
cloudinary.url(process.env.CLOUDINARY_URL);
//-----------------------------------------
const Schema = mongoose.Schema;

// установка схемы
const clothesScheme = new Schema({
  name: {
    type: String,
    default: 'None',
  },

  views: {
    type: Number,
    default: 0,
  },
  type: {
    type: String,
    enum: ['top', 'pants', 'shoes', 'watch'],
    default: 'None',
  },
  description: {
    type: String,
    default: 'None',
  },
  price: {
    type: Number,
    default: 0,
  },
  imageUrl: {
    type: String,
    default: 'None',
  },
  designer: {
    type: String,
    default: 'None',
  },
  sizes: {
    type: Array,
    default: [
      {
        S: 'Yes',
      },
      {
        M: 'No',
      },
      {
        L: 'No',
      },
      {
        XL: 'Yes',
      },
    ],
  },
  color: {
    type: String,
    default: 'None',
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: 'None',
  },
  age: {
    type: String,
    enum: ['old', 'kids'],
    default: 'None',
  },
});

const newCollectionScheme = new Schema({
  name: {
    type: String,
    default: 'None',
  },
  description: {
    type: String,
    default: 'None',
  },
  id_clothes: [{ type: Schema.Types.ObjectId, ref: 'Clothes' }],
});

const UserSchema = new Schema({
  username: String,
  hash: String,
  salt: String,
});

// подключение
const conn = process.env.MONGOCONNECTION;
const connection = mongoose.connect(conn, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});
// const db = mongoose.connection;
const Clothes = mongoose.model('Clothes', clothesScheme);
const User = mongoose.model('User', UserSchema);
const NewCollection = mongoose.model('Newcollection', newCollectionScheme);
function validPassword(password, hash, salt) {
  var hashVerify = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString(process.env.cryptoWord);
  return hash === hashVerify;
}
function genPassword(password) {
  var salt = crypto.randomBytes(32).toString(process.env.cryptoWord);
  var genHash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString(process.env.cryptoWord);

  return {
    salt: salt,
    hash: genHash,
  };
}
passport.use(
  new LocalStrategy(function (username, password, cb) {
    User.findOne({ username: username })
      .then((user) => {
        if (!user) {
          return cb(null, false, { message: 'Incorrect name' });
        }

        // Function defined at bottom of app.js
        const isValid = validPassword(password, user.hash, user.salt);

        if (isValid) {
          return cb(null, user);
        } else {
          return cb(null, false, { message: 'Incorrect password' });
        }
      })
      .catch((err) => {
        cb(err);
      });
  }),
);
passport.serializeUser(function (user, cb) {
  cb(null, user.id);
});
passport.deserializeUser(function (id, cb) {
  User.findById(id, function (err, user) {
    if (err) {
      return cb(err);
    }
    cb(null, user);
  });
});
const sessionStore = new MongoStore({
  mongooseConnection: mongoose.connection,
  collection: 'sessions',
});

app.use(
  session({
    secret: process.env.secret,
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.get('/clothes', function (req, res) {
  for (i = 1; i < 100; i++) {
    console.log('---------------------------------------------');
  }

  const filt = req.query;
  let desArray = filt.des;
  let colArray = filt.color;

  console.log(filt);
  console.log(desArray);
  const filtSizeArr = [];
  if (filt.sizeS === 'Yes') filtSizeArr.push({ S: 'Yes' });
  if (filt.sizeM === 'Yes') filtSizeArr.push({ M: 'Yes' });
  if (filt.sizeL === 'Yes') filtSizeArr.push({ L: 'Yes' });
  if (filt.sizeXL === 'Yes') filtSizeArr.push({ XL: 'Yes' });
  console.log(filtSizeArr);
  let itemMain = {
    clothes: [],
    designers: [],
    colors: [],
    minPrice: 1000000000,
    maxPrice: 0,
  };
  filt.sizeAll === 'Yes'
    ? Clothes.find(
        {
          // name: filt.search === '' ? { $ne: '' } : { $regex: filt.search },
          name: { $regex: filt.search },

          age: filt.age,
          type: filt.type === 'all' ? { $ne: '' } : filt.type,
          price: {
            $gte: filt.priceMin,
            $lte: filt.priceMax,
          },
          designer: filt.des === 'None' ? { $ne: '' } : { $in: desArray },
          color: filt.color === 'None' ? { $ne: '' } : { $in: colArray },
          gender: filt.gender === 'all' ? { $ne: '' } : filt.gender,
        },
        function (err, item) {
          // console.log(item);
          itemMain.clothes = item;
          for (let el = 0; el < item.length; el++) {
            const element = item[el];
            if (!itemMain.designers.includes(element.designer)) {
              itemMain.designers.push(element.designer);
            }
            if (!itemMain.colors.includes(element.color)) {
              itemMain.colors.push(element.color);
            }
            if (element.price < itemMain.minPrice) {
              itemMain.minPrice = element.price;
            }
            if (element.price > itemMain.maxPrice) {
              itemMain.maxPrice = element.price;
            }
          }

          if (itemMain.minPrice === 1000000000) itemMain.minPrice = 0;
          res.send(itemMain);
          console.log({
            designers: itemMain.designers,
            colors: itemMain.colors,
            minPrice: itemMain.minPrice,
            maxPrice: itemMain.maxPrice,
          });
        },
      ).sort({ views: -1 })
    : Clothes.find(
        {
          name: { $regex: filt.search },
          age: filt.age,
          type: filt.type === 'all' ? { $ne: '' } : filt.type,
          price: { $gte: filt.priceMin, $lte: filt.priceMax },
          sizes: { $in: filtSizeArr },
          designer: filt.des === 'None' ? { $ne: '' } : { $in: desArray },
          color: filt.color === 'None' ? { $ne: '' } : { $in: colArray },
          gender: filt.gender === 'all' ? { $ne: '' } : filt.gender,
        },
        function (err, item) {
          // console.log(item);
          itemMain.clothes = item;
          for (let el = 0; el < item.length; el++) {
            const element = item[el];
            if (!itemMain.designers.includes(element.designer)) {
              itemMain.designers.push(element.designer);
            }
            if (!itemMain.colors.includes(element.color)) {
              itemMain.colors.push(element.color);
            }
            if (element.price < itemMain.minPrice) {
              itemMain.minPrice = element.price;
            }
            if (element.price > itemMain.maxPrice) {
              itemMain.maxPrice = element.price;
            }
          }
          if (itemMain.minPrice === 1000000000) itemMain.minPrice = 0;
          res.send(itemMain);
          console.log({
            designers: itemMain.designers,
            colors: itemMain.colors,
            minPrice: itemMain.minPrice,
            maxPrice: itemMain.maxPrice,
          });
        },
      ).sort({ views: -1 });
});

app.get('/product', function (req, res) {
  console.log(req.query);
  let views = 0;

  Clothes.findOneAndUpdate(
    { _id: req.query.id }, // критерий выборки
    { $inc: { views: 1 } }, // параметр обновления
    {
      // доп. опции обновления
      returnDocument: 'before',
    },
    function (err, item) {
      res.send(item);
      console.log(item);
    },
  );
});

app.get('/controlAllItem', function (req, res) {
  const filters = req.query;
  console.log(filters);
  Clothes.find(
    {
      name: { $regex: filters.search },
      age: filters.ageType,
      type: filters.typeClothes === 'all' ? { $ne: '' } : filters.typeClothes,
      gender: filters.genderType,
    },
    function (err, items) {
      res.send(items);
    },
  );
});

app.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
    successRedirect: '/control',
  }),
  (err, req, res, next) => {
    if (err) next(err);
  },
);
app.post('/updateItem', function (req, res) {
  const rb = req.body;
  Clothes.updateOne(
    { _id: rb._id },
    {
      $set: {
        name: rb.name,
        description: rb.description,
        price: rb.price,
        designer: rb.designer,
        sizes: rb.sizes,
      },
    },
    function (req, res) {},
  );
  res.sendStatus(201);
  // res.send(rb);
});
// app.post('/login', passport.authenticate('local'), function (req, res) {
//   console.log(req.user);
//   res.redirect('/control');
// });
app.get('/register', (req, res, next) => {
  const form =
    '<h1>Register Page</h1><form method="post" action="register">\
                    Enter Username:<br><input type="text" name="username">\
                    <br>Enter Password:<br><input type="password" name="password">\
                    <br><br><input type="submit" value="Submit"></form>';
  res.send(form);
});
app.post('/register', (req, res, next) => {
  const saltHash = genPassword(req.body.password);

  const salt = saltHash.salt;
  const hash = saltHash.hash;
  const newUser = new User({
    username: req.body.username,
    hash: hash,
    salt: salt,
  });
  newUser.save().then((user) => {
    console.log(user);
  });
  res.redirect('/login');
});
app.get('/login', (req, res, next) => {
  console.log('get login ');
  const form = 'hhi2';
  //  `<div className="d-flex">
  //   <div className="controlAuthWrap">
  //     <div className="controlTitle">
  //       <svg
  //         style={{ marginTop: 3 }}
  //         className="logoDiamonHeader"
  //         width="43"
  //         height="42"
  //         viewBox="0 0 43 42"
  //         fill="none"
  //         xmlns="http://www.w3.org/2000/svg">
  //         <g clip-path="url(#clip0)">
  //           <path
  //             d="M42.8679 13.1793C35.4246 3.85734 35.742 4.09088 35.3446 4.05282L23.6931 2.51991C20.756 2.13346 18.7609 2.63574 17.7422 2.72573C17.4003 2.77068 17.1605 3.07788 17.2065 3.41183C17.2525 3.74578 17.5674 3.98047 17.9089 3.93511C18.9421 3.84258 20.795 3.37016 23.5263 3.72929L31.5274 4.78191C30.9286 4.9011 22.0991 6.65854 21.4998 6.77781L11.4725 4.78191L14.9385 4.3259C15.2804 4.28095 15.5202 3.97374 15.4742 3.6398C15.4282 3.30577 15.113 3.07149 14.7718 3.11652L7.65582 4.05266C7.65481 4.05274 7.6538 4.0529 7.65279 4.05307L7.64339 4.0543C7.63381 4.05561 7.62449 4.05766 7.615 4.05938C7.60887 4.06053 7.60257 4.06135 7.59653 4.06267C7.5914 4.06373 7.58628 4.0648 7.58124 4.06595C7.5741 4.06767 7.56705 4.06972 7.55999 4.07161C7.54907 4.07456 7.53816 4.07743 7.52741 4.08096C7.52295 4.08244 7.51876 4.08424 7.5143 4.0858C7.51237 4.08646 7.51044 4.08719 7.50859 4.08793C7.50238 4.09023 7.49591 4.09236 7.48978 4.09474C7.47853 4.09925 7.46761 4.10426 7.45669 4.10942C7.4519 4.11164 7.4472 4.11369 7.4425 4.11599C7.43721 4.11861 7.43208 4.12115 7.42696 4.12386C7.42201 4.12649 7.4173 4.12944 7.41235 4.13231C7.14108 4.28669 7.27352 4.2976 0.132107 13.1793C-0.0163767 13.3653 -0.0419078 13.6182 0.0667675 13.8289C0.318216 14.3162 -0.350549 13.3544 13.4353 31.2279C13.6431 31.4969 14.0348 31.5504 14.3103 31.3475C14.5857 31.1445 14.6404 30.7619 14.4327 30.4929L2.32401 14.8171L12.1083 17.8273C12.343 18.4318 19.5097 36.8951 19.6427 37.2376L16.1949 32.7742C15.9871 32.5052 15.5955 32.4517 15.3199 32.6546C15.0445 32.8576 14.9898 33.2402 15.1975 33.5092C18.8077 38.182 19.1797 38.6662 19.2054 38.6945C19.6615 39.1966 20.2923 39.5141 20.8957 39.6136C20.9849 39.6284 22.0316 39.6281 22.1191 39.6114C22.8799 39.4671 23.5224 39.0474 23.8258 38.6572L36.0198 22.8709C36.2274 22.6018 36.1727 22.2192 35.8973 22.0163C35.6217 21.8135 35.2302 21.867 35.0224 22.1359L23.357 37.238C23.7296 36.2779 30.6176 18.5328 30.8915 17.8274L40.6759 14.8172L36.7784 19.8627C36.5707 20.1318 36.6254 20.5144 36.9008 20.7173C37.1764 20.9203 37.568 20.8668 37.7758 20.5977C43.0081 13.8175 42.7262 14.2285 42.9327 13.8299C43.0419 13.619 43.0166 13.3656 42.8679 13.1793ZM21.4999 8.32614L29.0366 16.7241H13.9634L21.4999 8.32614ZM1.60661 13.317L7.53295 5.89392L11.5508 16.3766L1.60661 13.317ZM8.7073 5.47688C9.94422 5.72305 18.8134 7.48852 20.321 7.78859L12.8038 16.1649L8.7073 5.47688ZM21.569 38.4024H21.431L13.4899 17.9443H29.5101L21.569 38.4024ZM30.196 16.1648L22.6788 7.78859C23.6788 7.5895 32.7549 5.78302 34.2925 5.47688L30.196 16.1648ZM31.449 16.3764L35.4669 5.89376L41.3933 13.3169L31.449 16.3764Z"
  //             fill="black"
  //           />
  //         </g>
  //         <defs>
  //           <clipPath id="clip0">
  //             <rect width="43" height="42" fill="white" />
  //           </clipPath>
  //         </defs>
  //       </svg>
  //       <div className="mr-5 ml-10">SET</div>
  //       <div className="mr-5">|</div>
  //       <div>CONTROL</div>
  //     </div>
  //     <form method="POST" action="/login">
  //       <div className="inputDiv">
  //         <input
  //           autocomplete="off"
  //           name="username"
  //           className="inputControlAuth"
  //           placeholder="login"
  //           type="text"
  //         />
  //       </div>
  //       <div className="inputDiv">
  //         <input
  //           autocomplete="off"
  //           type="password"
  //           name="password"
  //           className="inputControlAuth"
  //           placeholder="password"
  //           type="password"
  //         />
  //       </div>
  //       <div>
  //         <input className="buttonAuthLogin" type="submit" value="Войти" />
  //       </div>
  //     </form>{' '}
  //   </div>
  // </div>`;
  // res.send(form);
  console.log(req.isAuthenticated());
  if (req.isAuthenticated()) {
    res.send({ authenticated: true, user: req.user.username });
  } else {
    res.send({ authenticated: false });
  }
});

app.get('/logout', (req, res, next) => {
  console.log('was logout');
  req.logOut();
  res.send('was logout');
});
app.get('/checkAuth', function (req, res) {
  console.log('get checkauth');
  console.log(req.isAuthenticated());
  if (req.isAuthenticated()) {
    res.send({ authenticated: true, user: req.user.username });
  } else {
    res.send({ authenticated: false });
  }
});
app.post('/addClothes', function (req, res) {
  // console.log(req.body);
  //  console.log(req.body.imgBase64);

  // upload image here
  cloudinary.uploader
    .upload(req.body.imgBase64, {
      folder: 'clothes',
    })
    .then((result) => {
      console.log(result);

      // console.log(result.url);
      let typeConvert;
      if (req.body.type === 'Верхняя одежда') {
        typeConvert = 'top';
      } else {
        if (req.body.type === 'Брюки') {
          typeConvert = 'pants';
        } else {
          if (req.body.type === 'Обувь') {
            typeConvert = 'shoes';
          } else {
            typeConvert = 'watch';
          }
        }
      }
      Clothes.create({
        name: req.body.name,
        views: 0,
        type: typeConvert,
        description: req.body.description,
        price: req.body.price,
        // price: Number(req.body.price),
        imageUrl: result.url,
        designer: req.body.designer,
        sizes: req.body.sizes,
        color: req.body.color,
        gender: req.body.gender === 'Мужской' ? 'male' : 'female',
        age: req.body.age === 'Взрослый' ? 'old' : 'kids',
        __v: 0,
      }).then((doc) => {
        res.status(200).send({
          message: 'Товар загружен',
          doc,
        });
      });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send({
        message: 'Не удалось загрузить товар',
        error,
      });
    });
});
app.post('/createCollection', function (req, res) {
  console.log(req.body);
  console.log(typeof req.body.items);
  NewCollection.updateOne(
    { _id: '61a4f06ce7fbcdf9addc7c7b' },
    {
      $set: {
        name: req.body.name,
        description: req.body.description,
        id_clothes: req.body.items,
      },
    },
  )
    .then((doc) => {
      res.status(200).send({
        message: 'Коллекция загружена',
        doc,
      });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send({
        message: 'Не удалось загрузить коллекцию',
        error,
      });
    });
});
app.get('/getCollection', async function (req, res) {
  // let arrCollect = [];
  // console.log('arrCollect');
  // console.log(arrCollect);
  let movie = await NewCollection.find({}).populate('id_clothes');
  console.log(movie);
  console.log(movie[0].id_clothes);
  res.send({ clothes: movie[0].id_clothes, name: movie[0].name, desc: movie[0].description });
});
app.post('/deleteItem', function (req, res) {
  console.log(req.body);

  Clothes.findByIdAndDelete({ _id: req.body._id })
    .then(() => {
      cloudinary.uploader.destroy(`clothes/${req.body.url}`, function (result) {});
      res.status(200).send({
        message: 'Товар удалён',
      });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send({
        message: 'Не удалось удалить товар',
        error,
      });
    });
});
app.listen(3001, () => {
  console.log('server is running');
});
