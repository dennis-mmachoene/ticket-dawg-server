const jwt = require('jsonwebtoken')
const User = require('../models/User')

const generateToken = (userId) => {
    return jwt.sign(
        {id: userId},
        process.env.JWT_SECRET,
        {expiresIn: process.env.JWT_EXPIRES_IN || '7d'}
    )
}

const login = async (req, res) => {
    try{
        const {username,password}=req.body;

        if(!username || !password){
            return res.status(400).json({ error: 'Username and password are required.'})
        }

        const user = await User.findOne({username: username.toLowerCase()})
    
        if(!user || !user.isActive){
            return res.status(401).json({error: 'Invalid credentials or account inactive'})
        }

        const isMatch = await user.comparePassword(password);

        if(!isMatch){
            return res.status(401).json({error: 'Invalid credentials'})
        }

        const token = generateToken(user._id)

        res.json({
            success: true, 
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                }
            }
        })
    } catch(error){
        console.error('Login error:', error),
        res.status(500).json({
            error: 'Server error during login',
        })
    }
}

const register = async (req, res) => {
    try{
        const {username, email, password, role = 'issuer'} = req.body;

        if(!username || !email || !password){
            return res.status(400).json({error: 'Username, email, and password are required'})
        }

        if(password.length < 6){
            return res.status(400).json({error: 'Password must be atleast 6 characters long'})
        }

        const existingUser = await User.findOne({
            $or: [
                {username: username.toLowerCase()},{email: email.toLowerCase()}
            ]
        })

        if(existingUser){
            return res.status(409).json({error: 'User with this username or email already exists'})
        }

        const newUser = new User({
            username: username.toLowerCase(), email: email.toLowerCase(), password, role, createdBy: req.user._id
        })

        await newUser.save();

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                    createdAt: newUser.createdAt
                }
            }
        })

    }catch(error){
        console.error('Registration error:', error);

        if(error.name === 'ValidationError'){
            return res.status(400).json({error: 'Validation error', details: Object.values(error.errors).map(err => err.message)})
        }

        res.status(500).json({error: 'Server error during registration'})
    }
} 


const getProfile = async (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    })
}

const getUsers = async (req, res) => {
    try{
     
        const users = await User.find({isActive: true}).select('-password').populate('createdAt', 'username').sort({createdAt: -1});

        res.json({
            success: true, data: {users, count: users.length}
        })
    }catch(error){
        console.error('Get users error:', error);
        res.status(500).json({error: 'Server error fetching users'})
    }
}

const deleteUser = async (req, res) => {
    try{
        const {id} = req.params;

        if(id == req.user._id.toString()){
            return res.status(400).json({
                error: 'Cannot delete your own account'
            })
        }

        const user = await User.findById(id);
        if(!user){
            return res.status(404).json({error: 'User not found'})
        }

        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        })
    }catch(error){
        console.error('Delete user error:',error);
        res.status(500).json({
            error: 'Server error deleting user'
        })
    }
}

module.exports = {
    login, register, getProfile, getUsers, deleteUser
}