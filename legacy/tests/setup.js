// Mock localStorage
const localStorageMock = {
    getItem: jest.fn((key) => {
        return localStorageMock.store[key] || null;
    }),
    setItem: jest.fn((key, value) => {
        localStorageMock.store[key] = value;
    }),
    removeItem: jest.fn((key) => {
        delete localStorageMock.store[key];
    }),
    clear: jest.fn(() => {
        localStorageMock.store = {};
    }),
    store: {}
};

global.localStorage = localStorageMock;

// Mock alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn();

// Reset mocks before each test
beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
});
