const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required().min(32),
  AWS_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  AWS_S3_BUCKET: Joi.string().optional().allow(''),
  AWS_REGION: Joi.string().default('us-east-1'),
  R2_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  R2_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  R2_ENDPOINT: Joi.string().optional().allow(''),
  R2_BUCKET_NAME: Joi.string().optional().allow(''),
  R2_PUBLIC_URL: Joi.string().optional().allow(''),
  FRONTEND_URL: Joi.string().optional().default('http://localhost:3000'),
  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.alternatives().try(Joi.number(), Joi.string().allow('')).optional(),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  MAIL_FROM: Joi.string().optional().allow(''),
  GMAIL_USER: Joi.string().optional().allow(''),
  GMAIL_APP_PASSWORD: Joi.string().optional().allow(''),
  GEMINI_API_KEY: Joi.string().optional(),
  GEMINI_MODEL: Joi.string().default('gemini-1.5-flash'),
}).unknown();

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = value;

