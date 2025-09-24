const express = require("express");
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgab')
const rateLimit = require('express-rate-limit')
const compression = require('compression')

const authRoutes = require('./routes/authRoutes')
const ticketRoutes = require('./routes/ticketRoutes')

const app = express();

app.use(helmet())

app.use(cors({ origin: process.env.FRONTEND_URL || ['http//localhost:3000', 'http://localhost:8081']}));

app.use(compression())

const authLimiter = rateLimit({
    windowMs: 15*60*1000,
    max:100,
    message:{
        error: 'Too many requests from this IP address, please try again later'
    }
})

app.use('/api/auth/login', authLimiter)

if(process.env.NODE_ENV == 'development'){
    app.use(morgan('dev'))
}else{
    app.use(morgan('combined'))
}

app.use(express.json({limit: '10mb'}))
app.use(express.urlencoded({extended: true, limit: '10mb'}))

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Pool Party Ticketing API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    })

})

app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)

app.use('*', (req,res) => {
    res.status(404).json({error: 'Not found', path: req.originalUrl})

})


app.use((error, req,res,next)=> {
    console.error('Global error handler:', error);

    if(error.name == 'ValidationError'){
        return res.status(400).json({
            error: 'Validation error',
            details: Object.values(error.errors).map(err => err.message)
        })
    }

    if(error.name == 'CastError'){
        return res.status(400).json({
            error: 'Invalid ID format'
        })
    }

    if(error.name == 'JsonWebTokenError'){
        return res.status(401).json({
            error: 'Invalid Token'
        })
    }

    if(error.name == 'TokenExpiredError'){
        return res.status(401).json({error: 'Token expired'})
    }

    if(error.code == 11000){
        const field = Object.keys(error.keyValue)[0]
        return res.status(409).json({error: `${field} already exists`})
    }

    return res.status(500).json({
        error: error.message || 'Internal Server error', ...(process.env.NODE_ENV && {stack: error.stack})
    })
})

module.exports = app;