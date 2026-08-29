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
  FRONTEND_URL: Joi.string().optional().default('http://localhost:3000'),
  GEMINI_API_KEY: Joi.string().optional(),
  GEMINI_MODEL: Joi.string().default('gemini-1.5-flash'),
}).unknown();

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = value;

