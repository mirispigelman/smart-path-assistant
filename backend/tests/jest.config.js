export default {
  testEnvironment: 'node',
  transform: {}, // required for ES Modules support
  
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'utils/**/*.js'
  ],

  coverageThreshold: {
    global: {
      lines: 50,
      functions: 50
    }
  }
};
