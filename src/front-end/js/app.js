// Configuration
const config = {
    apiBaseUrl: 'https://xbx29r53f6.execute-api.us-west-2.amazonaws.com/dev/api', // Will be replaced with actual API Gateway URL after deployment
    recordsPerPage: 10,
    cognito: {
        UserPoolId: 'us-west-2_JXC0W6fdd', // Replace after deployment
        ClientId: '1bbnldrsk45geil7jhrjb8sikv', // Replace after deployment
        region: 'us-west-2'
    }
};

// State management
const state = {
    currentPage: 1,
    nextToken: null,
    prevTokens: [],
    currentTab: 'records',
    searchParams: {
        job_id: '',
        result: '',
        object: ''
    },
    isAuthenticated: false,
    idToken: null,
    pendingUser: null
};

// DOM Elements
const elements = {
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    loginForm: {
        container: document.getElementById('login-form'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        loginButton: document.getElementById('login-button'),
        error: document.getElementById('error'),
        signupLink: document.getElementById('signup-link')
    },
    signupForm: {
        container: document.getElementById('signup-form'),
        email: document.getElementById('signup-email'),
        password: document.getElementById('signup-password'),
        confirmPassword: document.getElementById('confirm-password'),
        signupButton: document.getElementById('signup-button'),
        error: document.getElementById('signup-error'),
        success: document.getElementById('signup-success'),
        showLoginLink: document.getElementById('show-login-link')
    },
    verificationForm: {
        container: document.getElementById('verification-form'),
        code: document.getElementById('verification-code'),
        verifyButton: document.getElementById('verify-button'),
        error: document.getElementById('verification-error')
    },
    userInfo: {
        usernameDisplay: document.getElementById('username-display'),
        logoutButton: document.getElementById('logout-button')
    },
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    searchForm: {
        jobId: document.getElementById('job-id'),
        result: document.getElementById('result'),
        object: document.getElementById('object'),
        searchButton: document.getElementById('search-button'),
        clearButton: document.getElementById('clear-button')
    },
    resultsTable: {
        body: document.getElementById('results-body'),
        prevButton: document.getElementById('prev-page'),
        nextButton: document.getElementById('next-page'),
        pageInfo: document.getElementById('page-info')
    },
    uploadForm: {
        fileInput: document.getElementById('file-upload'),
        uploadButton: document.getElementById('upload-button'),
        progressBar: document.getElementById('upload-progress-bar'),
        status: document.getElementById('upload-status')
    },
    loading: document.getElementById('loading')
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize authentication
    initAuth();
    
    // Tab switching
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Search form
    elements.searchForm.searchButton.addEventListener('click', handleSearch);
    elements.searchForm.clearButton.addEventListener('click', clearSearch);

    // Pagination
    elements.resultsTable.prevButton.addEventListener('click', goToPrevPage);
    elements.resultsTable.nextButton.addEventListener('click', goToNextPage);

    // File upload
    elements.uploadForm.uploadButton.addEventListener('click', handleFileUpload);
});

// Authentication Functions
function initAuth() {
    // Setup login form
    if (elements.loginForm.loginButton) {
        elements.loginForm.loginButton.addEventListener('click', login);
    }
    
    // Setup signup link
    if (elements.loginForm.signupLink) {
        elements.loginForm.signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSignupForm();
        });
    }
    
    // Setup signup form
    if (elements.signupForm.signupButton) {
        elements.signupForm.signupButton.addEventListener('click', signup);
    }
    
    // Setup show login link
    if (elements.signupForm.showLoginLink) {
        elements.signupForm.showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }
    
    // Setup verification form
    if (elements.verificationForm.verifyButton) {
        elements.verificationForm.verifyButton.addEventListener('click', verifyAccount);
    }
    
    // Setup logout button
    if (elements.userInfo.logoutButton) {
        elements.userInfo.logoutButton.addEventListener('click', logout);
    }
    
    // Check if user is already authenticated
    checkAuthentication();
}

function checkAuthentication() {
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(config.cognito);
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser == null) {
        // Show login form if not authenticated
        showAuthForm();
        return;
    }
    
    cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) {
            console.error('Error getting session:', err);
            showAuthForm();
            return;
        }
        
        // User is authenticated
        state.isAuthenticated = true;
        state.idToken = session.getIdToken().getJwtToken();
        
        // Display username
        if (elements.userInfo.usernameDisplay) {
            elements.userInfo.usernameDisplay.textContent = cognitoUser.username;
        }
        
        // Show app and load initial data
        showApp();
        loadRecords();
    });
}

function login() {
    const username = elements.loginForm.username.value;
    const password = elements.loginForm.password.value;
    const errorElement = elements.loginForm.error;
    
    if (!username || !password) {
        showError(errorElement, 'Please enter both username and password');
        return;
    }
    
    const authenticationData = {
        Username: username,
        Password: password
    };
    
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(config.cognito);
    
    const userData = {
        Username: username,
        Pool: userPool
    };
    
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    
    // Use USER_PASSWORD_AUTH flow
    cognitoUser.setAuthenticationFlowType('USER_PASSWORD_AUTH');
    
    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
            // Successfully logged in
            state.isAuthenticated = true;
            state.idToken = result.getIdToken().getJwtToken();
            
            // Display username
            if (elements.userInfo.usernameDisplay) {
                elements.userInfo.usernameDisplay.textContent = username;
            }
            
            // Show app and load initial data
            showApp();
            loadRecords();
        },
        onFailure: (err) => {
            // Failed to authenticate
            showError(errorElement, err.message || 'Failed to login. Please check your credentials.');
            console.error('Authentication error:', err);
        }
    });
}

function signup() {
    const email = elements.signupForm.email.value;
    const password = elements.signupForm.password.value;
    const confirmPassword = elements.signupForm.confirmPassword.value;
    const errorElement = elements.signupForm.error;
    const successElement = elements.signupForm.success;
    
    // Reset messages
    if (errorElement) errorElement.style.display = 'none';
    if (successElement) successElement.style.display = 'none';
    
    // Validate inputs
    if (!email || !password || !confirmPassword) {
        showError(errorElement, 'Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(errorElement, 'Passwords do not match');
        return;
    }
    
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(config.cognito);
    
    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        })
    ];
    
    userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
            showError(errorElement, err.message || 'An error occurred during sign up');
            return;
        }
        
        // Store username for verification
        state.pendingUser = email;
        
        // Show success message
        if (successElement) {
            successElement.textContent = 'Registration successful! Please check your email for verification code.';
            successElement.style.display = 'block';
        }
        
        // Show verification form
        showVerificationForm();
    });
}

function verifyAccount() {
    const code = elements.verificationForm.code.value;
    const errorElement = elements.verificationForm.error;
    
    if (!code) {
        showError(errorElement, 'Please enter verification code');
        return;
    }
    
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(config.cognito);
    
    const userData = {
        Username: state.pendingUser,
        Pool: userPool
    };
    
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    
    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            showError(errorElement, err.message || 'Failed to verify account');
            return;
        }
        
        // Show success message
        alert('Account verified successfully! Please login.');
        
        // Show login form
        showLoginForm();
    });
}

function logout() {
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(config.cognito);
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser) {
        cognitoUser.signOut();
        state.isAuthenticated = false;
        state.idToken = null;
        showAuthForm();
    }
}

function showAuthForm() {
    if (elements.authContainer) {
        elements.authContainer.style.display = 'block';
    }
    if (elements.appContainer) {
        elements.appContainer.style.display = 'none';
    }
    
    // Default to showing login form
    showLoginForm();
}

function showLoginForm() {
    elements.loginForm.container.classList.add('active');
    elements.signupForm.container.classList.remove('active');
    elements.verificationForm.container.classList.remove('active');
}

function showSignupForm() {
    elements.loginForm.container.classList.remove('active');
    elements.signupForm.container.classList.add('active');
    elements.verificationForm.container.classList.remove('active');
}

function showVerificationForm() {
    elements.loginForm.container.classList.remove('active');
    elements.signupForm.container.classList.remove('active');
    elements.verificationForm.container.classList.add('active');
}

function showApp() {
    if (elements.authContainer) {
        elements.authContainer.style.display = 'none';
    }
    if (elements.appContainer) {
        elements.appContainer.style.display = 'block';
    }
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    } else {
        alert(message);
    }
}

// Tab switching function
function switchTab(tabName) {
    state.currentTab = tabName;
    
    // Update active tab button
    elements.tabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Show active tab content
    elements.tabContents.forEach(content => {
        if (content.id === `${tabName}-tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// API Functions
async function fetchRecords(params = {}) {
    try {
        // Show loading indicator
        if (elements.loading) {
            elements.loading.style.display = 'block';
        }
        
        // Build query string
        const queryParams = new URLSearchParams();
        
        // Add pagination
        queryParams.append('limit', config.recordsPerPage);
        if (params.nextToken) {
            queryParams.append('nextToken', params.nextToken);
        }
        
        // Add search filters
        if (params.job_id) {
            queryParams.append('job_id', params.job_id);
        }
        if (params.result) {
            queryParams.append('result', params.result);
        }
        if (params.object) {
            queryParams.append('object', params.object);
        }
        
        // Make API request with authentication token
        const response = await fetch(`${config.apiBaseUrl}/records?${queryParams.toString()}`, {
            headers: {
                'Authorization': `Bearer ${state.idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching records:', error);
        showError(null, 'Failed to load records. Please try again.');
        return { items: [], count: 0 };
    } finally {
        // Hide loading indicator
        if (elements.loading) {
            elements.loading.style.display = 'none';
        }
    }
}

async function uploadFile(file) {
    try {
        // Get file details
        const fileName = file.name;
        const fileType = file.type;
        
        // First, get a presigned URL
        const urlResponse = await fetch(`${config.apiBaseUrl}/upload?filename=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(fileType)}`, {
            headers: {
                'Authorization': `Bearer ${state.idToken}`
            }
        });
        
        if (!urlResponse.ok) {
            throw new Error(`Failed to get upload URL: ${urlResponse.status}`);
        }
        
        const urlData = await urlResponse.json();
        const presignedUrl = urlData.presignedUrl;
        
        // Upload the file using the presigned URL
        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': fileType
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload file: ${uploadResponse.status}`);
        }
        
        return {
            success: true,
            fileKey: urlData.fileKey
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Data Functions
async function loadRecords() {
    // Check authentication first
    if (!state.isAuthenticated) {
        showAuthForm();
        return;
    }
    
    try {
        const data = await fetchRecords({
            nextToken: state.nextToken,
            ...state.searchParams
        });
        
        renderRecords(data.items || []);
        updatePagination(!!data.nextToken);
        
        // Update state
        state.nextToken = data.nextToken;
    } catch (error) {
        console.error('Error loading records:', error);
    }
}

function handleSearch() {
    // Get search parameters
    state.searchParams = {
        job_id: elements.searchForm.jobId.value,
        result: elements.searchForm.result.value,
        object: elements.searchForm.object.value
    };
    
    // Reset pagination
    state.currentPage = 1;
    state.nextToken = null;
    state.prevTokens = [];
    
    // Load records with search parameters
    loadRecords();
}

function clearSearch() {
    // Clear form inputs
    elements.searchForm.jobId.value = '';
    elements.searchForm.result.value = '';
    elements.searchForm.object.value = '';
    
    // Clear search parameters
    state.searchParams = {
        job_id: '',
        result: '',
        object: ''
    };
    
    // Reset pagination
    state.currentPage = 1;
    state.nextToken = null;
    state.prevTokens = [];
    
    // Load records without search parameters
    loadRecords();
}

function goToPrevPage() {
    if (state.currentPage > 1) {
        state.nextToken = state.prevTokens.pop();
        state.currentPage--;
        loadRecords();
    }
}

function goToNextPage() {
    if (state.nextToken) {
        state.prevTokens.push(state.nextToken);
        state.currentPage++;
        loadRecords();
    }
}

async function handleFileUpload() {
    const fileInput = elements.uploadForm.fileInput;
    const progressBar = elements.uploadForm.progressBar;
    const statusElement = elements.uploadForm.status;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        statusElement.textContent = 'Please select a file to upload';
        statusElement.className = 'status-message error';
        return;
    }
    
    const file = fileInput.files[0];
    
    // Show progress (simulated for now)
    progressBar.style.width = '0%';
    statusElement.textContent = 'Uploading...';
    statusElement.className = 'status-message info';
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 90) {
            progressBar.style.width = `${progress}%`;
        }
    }, 200);
    
    try {
        const result = await uploadFile(file);
        
        clearInterval(progressInterval);
        
        if (result.success) {
            progressBar.style.width = '100%';
            statusElement.textContent = 'File uploaded successfully!';
            statusElement.className = 'status-message success';
            
            // Reset file input
            fileInput.value = '';
            
            // Reload records after a short delay
            setTimeout(() => {
                loadRecords();
            }, 1500);
        } else {
            progressBar.style.width = '0%';
            statusElement.textContent = `Upload failed: ${result.error}`;
            statusElement.className = 'status-message error';
        }
    } catch (error) {
        clearInterval(progressInterval);
        progressBar.style.width = '0%';
        statusElement.textContent = `Upload failed: ${error.message}`;
        statusElement.className = 'status-message error';
    }
}

// UI Functions
function renderRecords(records) {
    const tableBody = elements.resultsTable.body;
    tableBody.innerHTML = '';
    
    if (records.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" class="no-results">No records found</td>';
        tableBody.appendChild(row);
        return;
    }
    
    records.forEach(record => {
        // Create main row with Object and Result
        const mainRow = document.createElement('tr');
        mainRow.innerHTML = `
            <td>${escapeHtml(record.Object || '')}</td>
            <td>${escapeHtml(record.result)}</td>
            <td>${escapeHtml(record.date)}</td>
        `;
        tableBody.appendChild(mainRow);
        
        // Create secondary row with Job ID and Rationale
        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row';
        detailRow.innerHTML = `
            <td colspan="3">
                <div class="detail-content">
                    <div><strong>Job ID:</strong> ${escapeHtml(record.job_id)}</div>
                    <div><strong>Rationale:</strong> ${escapeHtml(record.Rationale || 'No rationale provided')}</div>
                </div>
            </td>
        `;
        tableBody.appendChild(detailRow);
    });
}

function updatePagination(hasNext) {
    // Update page info
    elements.resultsTable.pageInfo.textContent = `Page ${state.currentPage}`;
    
    // Update button states
    elements.resultsTable.prevButton.disabled = state.currentPage <= 1;
    elements.resultsTable.nextButton.disabled = !hasNext;
}

function showUploadProgress(percent) {
    if (elements.uploadForm.progressBar) {
        elements.uploadForm.progressBar.style.width = `${percent}%`;
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}