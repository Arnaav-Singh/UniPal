// Creates signed JWT access tokens encoding the user identity and role.
import jwt from 'jsonwebtoken';

const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export default generateToken;
