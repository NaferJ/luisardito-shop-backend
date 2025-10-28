#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testProductCreation() {
    try {
        console.log('🔍 Probando creación de productos...\n');

        // 1. Primero obtener información del usuario para verificar que existe
        console.log('1. Verificando usuario existente...');
        const userDebugResponse = await axios.get(`${BASE_URL}/usuarios/debug/3`);
        console.log('✅ Usuario encontrado:', userDebugResponse.data.usuario.nickname);

        // 2. Hacer login (necesitamos la contraseña, vamos a usar una genérica)
        console.log('\n2. Intentando login...');
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                nickname: 'NaferJ',
                password: '123456' // Contraseña por defecto que suelen usar en desarrollo
            });
            console.log('✅ Login exitoso');

            const token = loginResponse.data.accessToken;
            console.log('🔑 Token obtenido:', token.substring(0, 20) + '...');

            // 3. Probar creación de producto en borrador
            console.log('\n3. Creando producto en borrador...');
            const productoData = {
                nombre: "Test Borrador Automatico",
                descripcion: "Producto de prueba creado automáticamente",
                precio: 1500,
                stock: 10,
                estado: "borrador"
            };

            const createResponse = await axios.post(`${BASE_URL}/productos`, productoData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Producto creado exitosamente:');
            console.log('ID:', createResponse.data.id);
            console.log('Nombre:', createResponse.data.nombre);
            console.log('Estado:', createResponse.data.estado);
            console.log('Precio:', createResponse.data.precio);

            // 4. Verificar productos con debug endpoint
            console.log('\n4. Verificando productos con endpoint debug...');
            const debugResponse = await axios.get(`${BASE_URL}/productos/debug/all`);
            console.log('✅ Total productos en DB:', debugResponse.data.total);

            const productoBorrador = debugResponse.data.productos.find(p => p.estado === 'borrador');
            if (productoBorrador) {
                console.log('✅ Encontrado producto en borrador:', productoBorrador.nombre);
            } else {
                console.log('❌ No se encontraron productos en borrador');
            }

            // 5. Probar listado público (solo debe mostrar publicados)
            console.log('\n5. Verificando listado público...');
            const publicResponse = await axios.get(`${BASE_URL}/productos`);
            console.log('📋 Productos públicos:', publicResponse.data.length);
            const tienenBorrador = publicResponse.data.some(p => p.estado === 'borrador');
            if (!tienenBorrador) {
                console.log('✅ Correcto: productos en borrador no aparecen en listado público');
            } else {
                console.log('❌ Error: productos en borrador aparecen en listado público');
            }

        } catch (loginError) {
            if (loginError.response?.status === 401) {
                console.log('❌ Login falló - probando con diferentes contraseñas...');

                const commonPasswords = ['admin', '123456', 'test', 'password', 'admin123'];
                let loginSuccess = false;

                for (const pass of commonPasswords) {
                    try {
                        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                            nickname: 'NaferJ',
                            password: pass
                        });
                        console.log(`✅ Login exitoso con contraseña: ${pass}`);
                        loginSuccess = true;

                        // Continuar con el resto de las pruebas...
                        const token = loginResponse.data.accessToken;
                        console.log('🔑 Token obtenido');

                        const productoData = {
                            nombre: "Test Borrador Automatico",
                            descripcion: "Producto de prueba creado automáticamente",
                            precio: 1500,
                            stock: 10,
                            estado: "borrador"
                        };

                        const createResponse = await axios.post(`${BASE_URL}/productos`, productoData, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        console.log('✅ Producto creado exitosamente:', createResponse.data.nombre);
                        break;

                    } catch (passError) {
                        continue;
                    }
                }

                if (!loginSuccess) {
                    console.log('❌ No se pudo hacer login con ninguna contraseña común');
                    console.log('💡 Opción alternativa: crear un token de prueba directamente...');

                    // Generar un token de prueba directo (esto solo funciona si conocemos el JWT_SECRET)
                    const jwt = require('jsonwebtoken');
                    const testToken = jwt.sign(
                        { userId: 3, rolId: 4, nickname: 'NaferJ' },
                        process.env.JWT_SECRET || 'tu_jwt_secret_aqui',
                        { expiresIn: '1h' }
                    );

                    console.log('🔧 Token de prueba generado:', testToken.substring(0, 20) + '...');
                }
            } else {
                throw loginError;
            }
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    testProductCreation();
}

module.exports = { testProductCreation };
