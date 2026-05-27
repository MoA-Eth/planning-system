pipeline {
    agent {
        label 'builtin-linux'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        DOCKER_IMAGE_BACKEND  = 'moa-agriplan-backend'
        DOCKER_IMAGE_FRONTEND = 'moa-agriplan-frontend'
        DOCKER_TAG            = "${BUILD_NUMBER}"

        REMOTE_SERVER = '10.10.20.233'
        REMOTE_USER   = 'moapms'
        REMOTE_PATH   = '/home/moapms/moa-planning-system'

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
                        url: 'https://github.com/lidu5/planning-system.git',
                        credentialsId: 'moapms-ssh-key'
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
                    args '-v $WORKSPACE:/app -u root'
                }
            }
            steps {
                dir('backend') {
                    sh '''
                        pip install -r requirements.txt flake8 --no-cache-dir
                        flake8 . --count --exit-zero --max-line-length=127
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
                    args '-v $WORKSPACE:/app -u root'
                }
            }
            steps {
                dir('backend/moa_agriplan_system') {
                    sh '''
                        pip install -r ../requirements.txt --no-cache-dir
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
                        docker.build("${DOCKER_IMAGE_BACKEND}:${DOCKER_TAG}")
                        docker.build("${DOCKER_IMAGE_BACKEND}:latest")
                    }
                    dir('frontend/planning-vite') {
                        docker.build("${DOCKER_IMAGE_FRONTEND}:${DOCKER_TAG}")
                        docker.build("${DOCKER_IMAGE_FRONTEND}:latest")
                    }
                }
            }
        }

        /* ================= DEPLOY ================= */
        stage('Deploy to Production') {
            steps {
                input message: "Deploy to ${REMOTE_SERVER}?", ok: "Deploy"

                withCredentials([usernamePassword(
                    credentialsId: 'moapms-ssh-key',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sshagent(['moapms3-ssh-key']) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_SERVER} bash -s << EOF
set -e

mkdir -p ${REMOTE_PATH}
cd ${REMOTE_PATH}

git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

if [ ! -d .git ]; then
    git clone --depth=1 https://\${GIT_USER}:\${GIT_TOKEN}@github.com/lidu5/planning-system.git .
else
    git fetch https://\${GIT_USER}:\${GIT_TOKEN}@github.com/lidu5/planning-system.git main
    git reset --hard FETCH_HEAD
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "❌ Configure .env before deployment"
    exit 1
fi

docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

sleep 20

docker exec moa-backend-prod python manage.py migrate --noinput
docker exec moa-backend-prod python manage.py collectstatic --noinput

echo "✅ Deployment completed"
echo "🌐 http://${REMOTE_SERVER}:8080"
EOF
                        """
                    }
                }
            }
        }

        /* ================= HEALTH CHECK ================= */
        stage('Health Check') {
            steps {
                sh """
                    sleep 20
                    curl -f http://${REMOTE_SERVER}:8080/health || true
                    curl -f http://${REMOTE_SERVER}:8080/api/ || true
                """
            }
        }
    }

    post {
        always {
            cleanWs()
            sh '''
                docker image prune -f || true
                docker volume prune -f || true
            '''
        }
        success {
            echo '✅ PIPELINE SUCCESS'
        }
        failure {
            echo '❌ PIPELINE FAILED'
        }
    }
}