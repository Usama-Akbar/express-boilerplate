'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const AppError = require('./app-error.helper');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const ISSUER = process.env.JWT_ISSUER || 'saas-app';
const AUDIENCE = process.env.JWT_AUDIENCE || 'saas-users';

function generateAccessToken(payload) {
  return jwt.sign(
    { ...payload, type: 'access', jti: uuidv4() },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

function generateRefreshToken(payload) {
  return jwt.sign(
    { ...payload, type: 'refresh', jti: uuidv4() },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired', 401, 'TOKEN_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AppError('Invalid access token', 401, 'TOKEN_INVALID');
    }
    throw new AppError('Token verification failed', 401, 'TOKEN_ERROR');
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID');
  }
}

function decodeToken(token) {
  return jwt.decode(token);
}

function generateTokenPair(payload) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
}

function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization header missing or invalid format', 401, 'AUTH_HEADER_MISSING');
  }
  return authHeader.split(' ')[1];
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  generateTokenPair,
  extractTokenFromHeader,
};
