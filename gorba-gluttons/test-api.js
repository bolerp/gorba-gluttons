// 🧪 Тест API системы рефандов
const fetch = require('node-fetch');

const SERVER_URL = 'http://localhost:3001';
const TEST_WALLET = 'TestWallet1234567890123456789012345678901234';

async function testRefundAPI() {
    console.log('🧪 Тестирование API системы рефандов\n');

    try {
        // 1. Проверяем доступность рефанда
        console.log('1️⃣ Проверяем доступность рефанда...');
        const availableResponse = await fetch(`${SERVER_URL}/refund-available/${TEST_WALLET}`);
        const available = await availableResponse.json();
        console.log('✅ Ответ:', available);
        console.log('');

        // 2. Если доступен - делаем клейм
        if (available.available) {
            console.log('2️⃣ Делаем клейм рефанда...');
            const claimResponse = await fetch(`${SERVER_URL}/refund-claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: TEST_WALLET,
                    signature: 'test_signature_' + Date.now()
                })
            });
            const claimResult = await claimResponse.json();
            console.log('✅ Результат:', claimResult);
            console.log('');
        }

        // 3. Проверяем список pending рефандов (админка)
        console.log('3️⃣ Проверяем pending рефанды (админка)...');
        const pendingResponse = await fetch(`${SERVER_URL}/admin/pending-refunds`);
        const pending = await pendingResponse.json();
        console.log('✅ Pending рефанды:', pending);
        console.log('');

        // 4. Еще раз проверяем доступность (должно быть false)
        console.log('4️⃣ Повторная проверка доступности...');
        const available2Response = await fetch(`${SERVER_URL}/refund-available/${TEST_WALLET}`);
        const available2 = await available2Response.json();
        console.log('✅ Ответ:', available2);

    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// Запускаем тест
testRefundAPI(); 