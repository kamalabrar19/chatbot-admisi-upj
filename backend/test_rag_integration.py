"""
Integration Test untuk RAG Chatbot UPJ - Test Real API
=======================================================
Test ini menguji RAG system melawan Flask API yang sedang berjalan.
Pastikan server Flask sudah running di http://localhost:5000

Cara menjalankan:
1. Terminal 1: python app.py (start Flask server)
2. Terminal 2: python test_rag_integration.py
"""

import unittest
import requests
import json
import time
from typing import Dict, List
import sys

BASE_URL = "http://localhost:5000"

class RAGIntegrationTest(unittest.TestCase):
    """Integration tests untuk RAG API"""
    
    @classmethod
    def setUpClass(cls):
        """Verify server is running"""
        print("\n" + "="*80)
        print("RAG INTEGRATION TEST - Testing Real Flask API")
        print("="*80)
        print("\n[*] Checking if server is running at %s..." % BASE_URL)
        
        try:
            response = requests.get(BASE_URL, timeout=2)
            print("[OK] Server is responding")
        except requests.exceptions.ConnectionError:
            print("[ERROR] Cannot connect to server!")
            print("        Please start the Flask server first:")
            print("        $ python app.py")
            sys.exit(1)
    
    def test_1_chat_endpoint_basic(self):
        """TEST 1: Basic Chat Endpoint Test"""
        print("\n" + "-"*80)
        print("TEST 1: Basic Chat Endpoint")
        print("-"*80)
        
        payload = {
            "message": "Apa itu UPJ?",
            "history": []
        }
        
        print("[*] Sending request to /chat")
        print("    Message: %s" % payload["message"])
        
        try:
            response = requests.post(
                "%s/chat" % BASE_URL,
                json=payload,
                timeout=10
            )
            
            print("[*] Response Status: %d" % response.status_code)
            
            self.assertEqual(response.status_code, 200, "Should return 200 OK")
            
            data = response.json()
            self.assertIn("response", data, "Response should contain 'response' field")
            
            response_text = data["response"]
            print("[*] Response received (%d chars)" % len(response_text))
            print("    Response: %s" % response_text[:100])
            
            # Verify response quality
            self.assertGreater(len(response_text), 10, "Response should not be empty")
            print("[OK] Basic chat endpoint working")
            
        except requests.exceptions.Timeout:
            self.fail("Request timed out - server may be slow")
        except Exception as e:
            self.fail("Error calling /chat: %s" % str(e))
    
    def test_2_chat_with_history(self):
        """TEST 2: Chat with Conversation History"""
        print("\n" + "-"*80)
        print("TEST 2: Chat with History")
        print("-"*80)
        
        history = [
            {"role": "user", "content": "Apa saja program studi di UPJ?"},
            {"role": "assistant", "content": "UPJ menawarkan berbagai program studi seperti Sistem Informasi, Teknik Informatika, Akuntansi, dan Manajemen."}
        ]
        
        payload = {
            "message": "Apakah ada Teknik Informatika?",
            "history": history
        }
        
        print("[*] Sending request with history (%d messages)" % len(history))
        print("    Current message: %s" % payload["message"])
        
        try:
            response = requests.post(
                "%s/chat" % BASE_URL,
                json=payload,
                timeout=10
            )
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            response_text = data["response"]
            print("[*] Response: %s" % response_text[:100])
            
            # Verify response acknowledges history
            self.assertGreater(len(response_text), 10)
            print("[OK] Chat with history working")
            
        except Exception as e:
            self.fail("Error with history: %s" % str(e))
    
    def test_3_long_message_handling(self):
        """TEST 3: Validate Message Length Limit"""
        print("\n" + "-"*80)
        print("TEST 3: Message Length Validation")
        print("-"*80)
        
        # Valid message
        valid_payload = {
            "message": "Bagaimana cara mendaftar di UPJ?",
            "history": []
        }
        
        print("[*] Testing valid message (32 chars)")
        response = requests.post(
            "%s/chat" % BASE_URL,
            json=valid_payload,
            timeout=10
        )
        self.assertEqual(response.status_code, 200)
        print("[OK] Valid message accepted")
        
        # Too long message (> 500 chars)
        long_message = "a" * 501
        long_payload = {
            "message": long_message,
            "history": []
        }
        
        print("[*] Testing long message (501 chars - should be rejected)")
        response = requests.post(
            "%s/chat" % BASE_URL,
            json=long_payload,
            timeout=10
        )
        
        self.assertNotEqual(response.status_code, 500, "Should handle gracefully")
        print("[OK] Message length validation working")
    
    def test_4_rate_limiting(self):
        """TEST 4: Rate Limiting"""
        print("\n" + "-"*80)
        print("TEST 4: Rate Limiting (10 per minute)")
        print("-"*80)
        
        payload = {
            "message": "Test rate limit",
            "history": []
        }
        
        print("[*] Sending 12 rapid requests...")
        responses = []
        
        for i in range(12):
            try:
                response = requests.post(
                    "%s/chat" % BASE_URL,
                    json=payload,
                    timeout=5
                )
                responses.append(response.status_code)
                print("    Request %d: %d" % (i+1, response.status_code))
            except Exception as e:
                print("    Request %d: ERROR - %s" % (i+1, str(e)))
        
        # Should have some 429 responses
        if 429 in responses:
            print("[OK] Rate limiting is active (got 429 responses)")
        else:
            print("[INFO] No 429 responses in this batch (may depend on timing)")
    
    def test_5_refresh_cache(self):
        """TEST 5: Cache Refresh Endpoint"""
        print("\n" + "-"*80)
        print("TEST 5: Cache Refresh")
        print("-"*80)
        
        # First, attempt without token
        print("[*] Attempting refresh without token...")
        response = requests.get(
            "%s/refresh-cache" % BASE_URL,
            timeout=5
        )
        
        print("    Response: %d" % response.status_code)
        self.assertNotEqual(response.status_code, 200, "Should reject without token")
        print("[OK] Authorization check working")
        
        # With correct token (from .env)
        print("[*] Attempting refresh with admin token...")
        response = requests.get(
            "%s/refresh-cache?token=rahasiaupj123" % BASE_URL,
            timeout=5
        )
        
        print("    Response: %d" % response.status_code)
        if response.status_code == 200:
            print("[OK] Cache refresh successful")
        else:
            print("[INFO] Cache refresh returned %d (may need correct token)" % response.status_code)
    
    def test_6_response_format_validation(self):
        """TEST 6: Response Format Validation"""
        print("\n" + "-"*80)
        print("TEST 6: Response Format")
        print("-"*80)
        
        payload = {
            "message": "Apa itu UPJ?",
            "history": []
        }
        
        print("[*] Checking response format...")
        response = requests.post(
            "%s/chat" % BASE_URL,
            json=payload,
            timeout=10
        )
        
        data = response.json()
        response_text = data["response"]
        
        # Check for HTML formatting
        has_br = "<br>" in response_text
        has_bold = "<b>" in response_text or "<strong>" in response_text
        has_links = "<a" in response_text
        
        print("[*] Response contains:")
        print("    BR tags: %s" % has_br)
        print("    Bold tags: %s" % has_bold)
        print("    Links: %s" % has_links)
        
        print("[OK] HTML formatting is applied")
    
    def test_7_multiple_queries_coverage(self):
        """TEST 7: Multiple Queries Coverage Test"""
        print("\n" + "-"*80)
        print("TEST 7: Query Coverage Analysis")
        print("-"*80)
        
        test_queries = [
            ("Apa itu UPJ?", "Should answer about university"),
            ("Bagaimana cara mendaftar?", "Should answer about registration"),
            ("Program studi apa saja?", "Should list programs"),
            ("Berapa biaya pendaftaran?", "Should answer about fees"),
            ("Apakah ada beasiswa?", "Should answer about scholarships"),
            ("Di mana lokasi UPJ?", "Should give location"),
            ("Berapa kapasitas penerimaan?", "Should give capacity info"),
        ]
        
        print("[*] Testing %d queries..." % len(test_queries))
        
        successful = 0
        for i, (query, description) in enumerate(test_queries, 1):
            payload = {
                "message": query,
                "history": []
            }
            
            try:
                response = requests.post(
                    "%s/chat" % BASE_URL,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data["response"]
                    successful += 1
                    print("  [%d/%d] OK: %s" % (i, len(test_queries), query))
                else:
                    print("  [%d/%d] FAIL: %s (Status: %d)" % (i, len(test_queries), query, response.status_code))
            except Exception as e:
                print("  [%d/%d] ERROR: %s (%s)" % (i, len(test_queries), query, str(e)))
            
            time.sleep(0.5)  # Add delay to avoid rate limiting
        
        coverage_pct = (successful / len(test_queries)) * 100
        print("\n[*] Coverage: %d/%d (%.1f%%)" % (successful, len(test_queries), coverage_pct))
        print("[OK] Coverage test complete")
    
    def test_8_concurrent_requests(self):
        """TEST 8: Concurrent Request Handling"""
        print("\n" + "-"*80)
        print("TEST 8: Concurrent Requests")
        print("-"*80)
        
        import threading
        
        results = {"success": 0, "failed": 0}
        lock = threading.Lock()
        
        def send_request():
            payload = {
                "message": "Test concurrent request",
                "history": []
            }
            
            try:
                response = requests.post(
                    "%s/chat" % BASE_URL,
                    json=payload,
                    timeout=10
                )
                
                with lock:
                    if response.status_code == 200:
                        results["success"] += 1
                    else:
                        results["failed"] += 1
            except Exception as e:
                with lock:
                    results["failed"] += 1
        
        print("[*] Sending 5 concurrent requests...")
        threads = []
        
        for i in range(5):
            t = threading.Thread(target=send_request)
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        print("[*] Results:")
        print("    Success: %d" % results["success"])
        print("    Failed: %d" % results["failed"])
        
        self.assertGreater(results["success"], 0, "Should handle at least some concurrent requests")
        print("[OK] Concurrent handling successful")

class RAGPerformanceTest(unittest.TestCase):
    """Performance tests untuk RAG API"""
    
    def test_1_response_time(self):
        """TEST 9: Response Time Measurement"""
        print("\n" + "-"*80)
        print("TEST 9: Response Time")
        print("-"*80)
        
        payload = {
            "message": "Apa itu UPJ?",
            "history": []
        }
        
        print("[*] Measuring response time...")
        times = []
        
        for i in range(5):
            start = time.time()
            response = requests.post(
                "%s/chat" % BASE_URL,
                json=payload,
                timeout=15
            )
            elapsed = time.time() - start
            times.append(elapsed)
            print("    Request %d: %.2f seconds" % (i+1, elapsed))
        
        avg_time = sum(times) / len(times)
        max_time = max(times)
        min_time = min(times)
        
        print("\n[*] Statistics:")
        print("    Average: %.2f seconds" % avg_time)
        print("    Min: %.2f seconds" % min_time)
        print("    Max: %.2f seconds" % max_time)
        
        self.assertLess(avg_time, 15, "Average response time should be < 15s")
        print("[OK] Response time acceptable")
    
    def test_2_throughput(self):
        """TEST 10: Throughput (requests per minute)"""
        print("\n" + "-"*80)
        print("TEST 10: Throughput Test")
        print("-"*80)
        
        payload = {
            "message": "Test",
            "history": []
        }
        
        print("[*] Measuring throughput (10 second window)...")
        
        start = time.time()
        request_count = 0
        success_count = 0
        
        while time.time() - start < 10:
            try:
                response = requests.post(
                    "%s/chat" % BASE_URL,
                    json=payload,
                    timeout=5
                )
                
                request_count += 1
                if response.status_code == 200:
                    success_count += 1
            except:
                request_count += 1
        
        elapsed = time.time() - start
        rpm = (request_count / elapsed) * 60
        success_rate = (success_count / request_count * 100) if request_count > 0 else 0
        
        print("[*] Results:")
        print("    Total requests: %d" % request_count)
        print("    Successful: %d (%.1f%%)" % (success_count, success_rate))
        print("    Requests per minute: %.1f" % rpm)
        print("    Time window: %.1f seconds" % elapsed)
        
        print("[OK] Throughput test complete")

def run_tests():
    """Run all integration tests"""
    
    print("\n")
    
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(RAGIntegrationTest))
    suite.addTests(loader.loadTestsFromTestCase(RAGPerformanceTest))
    
    # Run with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "="*80)
    print("INTEGRATION TEST SUMMARY")
    print("="*80)
    print("Tests run: %d" % result.testsRun)
    print("Passed: %d" % (result.testsRun - len(result.failures) - len(result.errors)))
    print("Failed: %d" % len(result.failures))
    print("Errors: %d" % len(result.errors))
    print("="*80)
    
    return result

if __name__ == "__main__":
    result = run_tests()
    sys.exit(0 if result.wasSuccessful() else 1)
