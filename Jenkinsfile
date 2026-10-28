pipeline {
    agent {
        label 'builtin-linux'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    environment {
        DOCKER_IMAGE_BACKEND  = 'moa-agriplan-backend'
        DOCKER_IMAGE_FRONTEND = 'moa-agriplan-frontend'
        DOCKER_TAG            = "${BUILD_NUMBER}"

        REMOTE_SERVER = '10.10.20.233'
        REMOTE_USER   = 'moapms'
        REMOTE_PATH   = '/home/moapms/moa-planning-system'

        // Credential IDs (create these in Jenkins > Manage Credentials)
        // GITHUB_CREDS_ID : "Username with password" -> GitHub username + personal access token
        // SSH_CREDS_ID    : "SSH Username with private key" -> key for the deploy server
        GITHUB_CREDS_ID = 'pms'
        SSH_CREDS_ID    = 'moapms3-ssh-key'

        DJANGO_SETTINGS_MODULE = 'moa_agriplan_system.settings'
        PYTHONUNBUFFERED = '1'
    }

    stages {

        /* ================= CHECKOUT ================= */
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [[
                        $class: 'CloneOption',
                        shallow: true,
                        depth: 1,
                        timeout: 120
                    ]],
                    userRemoteConfigs: [[
                        url: 'https://github.com/MoA-Eth/planning-system.git',
                        credentialsId: "${GITHUB_CREDS_ID}"
                    ]]
                ])
            }
        }

        /* ================= LINT BACKEND ================= */
        stage('Lint Backend') {
            agent {
                docker {
                    image 'python:3.11'
                    label 'builtin-linux'
                    reuseNode true   // use the workspace that Checkout populated
                    args '-e HOME=/tmp -e PYTHONDONTWRITEBYTECODE=1'
                }
            }
            steps {
                dir('backend') {
                    sh '''
                        python -m pip install --user -r requirements.txt flake8 --no-cache-dir
                        python -m flake8 . --count --exit-zero --max-line-length=127
                    '''
                }
            }
        }

        /* ================= LINT FRONTEND ================= */
        stage('Lint Frontend') {
            agent {
                docker {
                    image 'node:20'
                    label 'builtin-linux'
                    reuseNode true
                    args '-e HOME=/tmp'
                }
            }
            steps {
                dir('frontend/planning-vite') {
                    sh '''
                        npm ci
                        npm run lint || true
                    '''
                }
            }
        }

        /* ================= TEST BACKEND ================= */
        stage('Test Backend') {
            agent {
                docker {
                    image 'python:3.11'
                    label 'builtin-linux'
                    reuseNode true
                    args '-e HOME=/tmp -e PYTHONDONTWRITEBYTECODE=1'
                }
            }
            steps {
                dir('backend/moa_agriplan_system') {
                    // If tests need SECRET_KEY / DB settings, add them to the environment block above.
                    sh '''
                        python -m pip install --user -r ../requirements.txt --no-cache-dir
                        python manage.py test --verbosity=2
                        python manage.py check --deploy
                    '''
                }
            }
        }

        /* ================= TEST FRONTEND ================= */
        stage('Test Frontend') {
            agent {
                docker {
                    image 'node:20'
                    label 'builtin-linux'
                    reuseNode true
                    args '-e HOME=/tmp'
                }
            }
            steps {
                dir('frontend/planning-vite') {
                    sh '''
                        npm ci
                        npm test -- --watch=false || true
                    '''
                }
            }
        }

        /* ================= BUILD DOCKER IMAGES ================= */
        stage('Build Docker Images') {
            steps {
                script {
                    dir('backend') {
                        def backendImg = docker.build("${DOCKER_IMAGE_BACKEND}:${DOCKER_TAG}")
                        backendImg.tag('latest')
                    }
                    dir('frontend/planning-vite') {
                        def frontendImg = docker.build("${DOCKER_IMAGE_FRONTEND}:${DOCKER_TAG}")
                        frontendImg.tag('latest')
                    }
                }
            }
        }

        /* ================= APPROVAL (no executor held) ================= */
        stage('Approve Deploy') {
            agent none
            options {
                timeout(time: 30, unit: 'MINUTES')
            }
            input {
                message "Deploy to ${REMOTE_SERVER}?"
                ok "Deploy"
            }
            steps {
                echo 'Deployment approved'
            }
        }

        /* ================= DEPLOY ================= */
        stage('Deploy to Production') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: "${GITHUB_CREDS_ID}",
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sshagent([env.SSH_CREDS_ID]) {
                        // Single-quoted so Groovy does NOT interpolate secrets.
                        // The local shell expands $GIT_USER, $GIT_TOKEN, $REMOTE_* inside the heredoc,
                        // and the script is sent over ssh stdin (not visible in the local process list).
                        sh '''
                            ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_SERVER} bash -s << EOF
set -e

mkdir -p ${REMOTE_PATH}
cd ${REMOTE_PATH}

git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

if [ ! -d .git ]; then
    git clone --depth=1 https://${GIT_USER}:${GIT_TOKEN}@github.com/MoA-Eth/planning-system.git .
else
    git fetch https://${GIT_USER}:${GIT_TOKEN}@github.com/MoA-Eth/planning-system.git main
    git reset --hard FETCH_HEAD
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Configure .env before deployment"
    exit 1
fi

# Use "docker compose" instead if the server has only the v2 plugin
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

sleep 20

docker exec moa-backend-prod python manage.py migrate --noinput
docker exec moa-backend-prod python manage.py collectstatic --noinput

echo "Deployment completed: http://${REMOTE_SERVER}:8080"
EOF
                        '''
                    }
                }
            }
        }

        /* ================= HEALTH CHECK ================= */
        stage('Health Check') {
            steps {
                // No "|| true": a failed check now fails the build.
                sh '''
                    curl -f --retry 6 --retry-delay 10 --retry-connrefused http://${REMOTE_SERVER}:8080/health
                    curl -f --retry 6 --retry-delay 10 --retry-connrefused http://${REMOTE_SERVER}:8080/api/
                '''
            }
        }
    }

    post {
        always {
            // Only prune dangling images. Do NOT prune volumes: this talks to the host's Docker daemon.
            sh 'docker image prune -f || true'
            cleanWs()
        }
        success {
            echo 'PIPELINE SUCCESS'
        }
        failure {
            echo 'PIPELINE FAILED'
        }
    }
}