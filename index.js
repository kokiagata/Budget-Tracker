if(process.env.NODE_ENV !== 'production'){
  require('dotenv').config()
}

const express = require('express')
const cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const uri = process.env.URI_DB
const passport = require('passport')
const localStrategy = require('passport-local').Strategy
const passportLocalMongoose = require('passport-local-mongoose')
const session = require('express-session')
const objectID = require('mongodb').ObjectID
const bcrypt = require('bcrypt')
const flash = require('connect-flash')
const requirejs = require('requirejs')
const cookieParser = require('cookie-parser')
const ejs = require('ejs')
const jsdom = require("jsdom")
const { JSDOM } = jsdom

global.document = new JSDOM(ejs).window.document;


app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(function(req, res, next){
  res.locals.messages = req.flash();
  next();
})
app.use(passport.initialize())
app.use(passport.session())
app.use(express.urlencoded({extended: false}))
app.set('view engine', 'ejs')
app.use(cors())
app.use(express.static('public'))
app.get('/', checkAuthenticated, (req, res) => {
  if(req.user.budget !== '' && req.user.budget != undefined){
    res.redirect('/expense-entered')
  }
  else{
res.render(__dirname + '/view/index.ejs')}
});
app.use(bodyParser.urlencoded({extended: false}));
mongoose.connect("mongodb+srv://kokiagata:Kokiagita0207!@puka.vonwo.mongodb.net/Puka?retryWrites=true&w=majority",{useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify:false});


const expenses = new mongoose.Schema({
    expense: Number,
    detail: String,
    date: String
})

const monthlyBudget = new mongoose.Schema({
    name: {type: String, unique: true},
    password: String,
    email: String,
    budget: Number,
    log:[expenses]
})

const budgetModel = mongoose.model('budgetModel', monthlyBudget)
const expenseModel = mongoose.model('expenseModel', expenses)



passport.use(new localStrategy(function(username, password, done){
  budgetModel.findOne({ name: username}, (error, user)=>{
    if(error){
      return done(error)
    }if(!user){
      console.log('no such user')
      return done(null, false, {message: 'No such user'})
    }
    if(user){
      bcrypt.compare(password, user.password, function(err, result){
        if(err){
          return done(error)
          console.log('error')
        } if(!result){
          return done(null, false, {message: "Wrong password"})
        } if(result){
          return done(null, user)
        }
      })
    }
     })
        })
);

passport.serializeUser((user, done)=> done(null, user._id))
passport.deserializeUser((id, done)=>{
  budgetModel.findById(id, function(error, user){
    done(error, user)
});
});


app.get('/login', (req, res)=>{
  req.flash('correct', 'Welcome!')
 res.render(__dirname + "/view/login.ejs")
})
app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/register', (req, res)=>{
  res.render(__dirname +'/view/register.ejs')
})

app.post('/register', async (req, res)=>{
    try{
      const hashedPassword = await bcrypt.hash(req.body.newPassword, 10)
    let newUser = new budgetModel({
      name: req.body.newUsername,
      password: hashedPassword,
      email: req.body.email,
    });
    newUser.save((err, result)=>{
      if(!err){
        console.log('registered!')
        res.redirect('/login')
    }
    })
    } catch{
        console.log('error')
        res.redirect('/public/register.ejs')
    }
    })

    app.post('/logout', (req, res)=>{
      req.logout();
      req.user = null;
        res.redirect('/login');
    })

app.post('/monthly-budget', (req, res)=>{
  budgetModel.findByIdAndUpdate(req.user._id,{budget: req.body.budget}, (err, registered)=>{
    if(!err){
      console.log('budget registered')
      res.render(__dirname + '/view/expense.ejs', {budgetMonth: req.body.budget, budget: req.body.budget, total: ''})
    } 
    if(err){
      console.log('error')
    }
  })
})

  
app.post('/expense-entered', (req, res)=>{
  let date;
  if(req.body.expenseDate === ''){
    date = new Date()
  } else{
    date = req.body.expenseDate
  }
  let newExpenses = new expenseModel({
    expense: req.body.expenseAmount,
    detail: req.body.expenseType,
    date: date.toISOString()
  })
if(req.user === undefined){
  res.redirect('/login')
}
  budgetModel.findByIdAndUpdate(req.user._id, {$push: {log: newExpenses}}, {new: true, upsert: true}, (err, updatedExpenses)=>{
    if(!err){
      let minus = updatedExpenses.log.filter((minusBudget)=>{
        return minusBudget.date.slice(0,7) ==  new Date().toISOString().slice(0,7)
      }).reduce((sub, val)=>{
        return sub + val.expense
      }, 0);
      let remaining2 = updatedExpenses.budget - minus;
      
      
      alert('Expense saved!')
      res.render(__dirname + '/view/expense.ejs', {budgetMonth: updatedExpenses.budget, budget: remaining2, total: ''})
      
      console.log('expense saved!')
    }
  })
})
app.get('/expense-entered', checkAuthenticated, (req, res)=>{
  budgetModel.findById(req.user._id, function(err, user){
    if(!err){
      let minus2 = user.log.filter((minusBudget2)=>{
        return minusBudget2.date.slice(0,7) == new Date().toISOString().slice(0,7)
      }).reduce((sub2, val2)=>{
        return sub2+val2.expense
      }, 0);
      let remaining = user.budget - minus2;
      
    res.render(__dirname + '/view/expense.ejs', {budgetMonth: user.budget, budget: remaining, total: ''})
    
    }
  })
  
})

app.post('/expense-total', (req, res)=>{
  let category = req.body.category;
  let date = req.body.monthSpent;
  if(date === ''){
    date = new Date().toISOString().slice(0,7);
  }

  budgetModel.findById(req.user._id, (err, result)=>{

    let minus3 = result.log.filter((minusBudget3)=>{
        return minusBudget3.date.slice(0,7) == new Date().toISOString().slice(0,7)
      }).reduce((sub3, val3)=>{
        return sub3+val3.expense
      }, 0);
    let remaining3 = result.budget - minus3;
    let total = result.log.filter((filterByMonth)=>{
        return filterByMonth.date.slice(0, 7) == date});    

    if(!err && category != 'All'){
      total = total.filter((filtered) =>{
        return filtered.detail == category;
      }).reduce((sum, item)=>{
        return sum+item.expense;
      }, 0);
    }
    if(!err && category == 'All'){
      total = total.reduce((sumAll, allItem)=>{
        return sumAll + allItem.expense;
      }, 0);
    }
    res.render(__dirname + '/view/expense.ejs', {budgetMonth: result.budget, total: category + ": $" + total.toFixed(2), budget: remaining3}) 
  })
})

app.get('/expense-total', checkAuthenticated,(req, res)=>{
  budgetModel.findById(req.user._id, (err, success)=>{
    let minus3 = success.log.filter((minusBudget3)=>{
        return minusBudget3.date.slice(0,7) == new Date().toISOString().slice(0,7)
      }).reduce((sub3, val3)=>{
        return sub3+val3.expense
      }, 0);
    let remaining3 = success.budget - minus3;
 res.render(__dirname + '/view/expense.ejs', {budgetMonth: success.budget, total: '', budget: remaining3})
  })
  })

app.post('/new-budget-added', (req, res)=>{
  budgetModel.findByIdAndUpdate(req.user._id, {budget: req.body.newBudget}, (err, newBudget)=>{
    if(err){
      alert('Error. Plase try again')
      res.render(__dirname + '/view/editBudget.ejs')
    } else{
      alert('Budget updated!')
      res.redirect('expense-entered')
      console.log("new budget added")
    }
  })
})

app.get('/new-budget-added', (req, res)=>{   
  res.render(__dirname + '/view/editBudget.ejs')
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
  })

  console.log(mongoose.connection.readyState)

function checkAuthenticated(req, res, next){
  if(req.isAuthenticated()){
    return next()
  }
  res.redirect('/login')
}
  
