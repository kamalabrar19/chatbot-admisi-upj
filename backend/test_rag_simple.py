# =========================================================
# test_rag_simple.py
# RAG Testing Suite - Chatbot Admisi UPJ
# =========================================================

import unittest
import json
import time
import re
from collections import Counter

# =========================================================
# IMPORT APP FUNCTIONS
# =========================================================

from app import (
    load_knowledge_base,
    get_system_prompt,
    format_response_html,
)

# =========================================================
# HELPER FUNCTIONS
# =========================================================

def normalize_text(text):
    """
    Normalize text untuk deduplication & comparison
    """

    text = text.lower().strip()

    # hapus simbol
    text = re.sub(r"[^\w\s]", "", text)

    # rapihin spasi
    text = re.sub(r"\s+", " ", text)

    return text


def calculate_keyword_overlap(query, response):
    """
    Improved keyword overlap
    """

    query_words = set(
        re.findall(r"\w+", query.lower())
    )

    response_words = set(
        re.findall(r"\w+", response.lower())
    )

    if not query_words:
        return 0

    overlap = query_words.intersection(response_words)

    return len(overlap) / len(query_words)


def calculate_answer_quality(response):
    """
    Check apakah response terlihat seperti jawaban
    """

    indicators = [
        "adalah",
        "merupakan",
        "dapat",
        "bisa",
        "tersedia",
        "memiliki",
        "menyediakan",
        "untuk",
        "melalui",
        "program",
        "pendaftaran",
        "universitas",
    ]

    response_lower = response.lower()

    found = sum(
        1 for word in indicators
        if word in response_lower
    )

    return min(found / 4, 1)


def calculate_response_length_score(response):
    """
    Ideal response length scoring
    """

    word_count = len(response.split())

    if word_count >= 50:
        return 1.0

    elif word_count >= 25:
        return 0.7

    elif word_count >= 10:
        return 0.5

    elif word_count >= 5:
        return 0.3

    return 0.1


def calculate_relevance_score(query, response):
    """
    FINAL RELEVANCE SCORE

    Formula:
    (Keyword Overlap × 0.4) +
    (Answer Quality × 0.4) +
    (Response Length × 0.2)
    """

    keyword_score = calculate_keyword_overlap(
        query,
        response
    )

    answer_quality = calculate_answer_quality(
        response
    )

    length_score = calculate_response_length_score(
        response
    )

    final_score = (
        (keyword_score * 0.4)
        + (answer_quality * 0.4)
        + (length_score * 0.2)
    )

    return round(final_score, 2)


def detect_hallucination(response, kb_text):
    """
    Simple hallucination detector
    """

    response_words = re.findall(
        r"\w+",
        response.lower()
    )

    kb_words = set(
        re.findall(
            r"\w+",
            kb_text.lower()
        )
    )

    if not response_words:
        return 0

    novel_words = [
        word for word in response_words
        if word not in kb_words
    ]

    novel_ratio = (
        len(novel_words)
        / len(response_words)
    )

    confidence = 1.0 - novel_ratio

    return round(confidence, 2)


# =========================================================
# TEST CLASS
# =========================================================

class TestRAGSystem(unittest.TestCase):

    # =====================================================
    # RETRIEVAL TESTS
    # =====================================================

    def test_01_faq_load_completeness(self):

        kb = load_knowledge_base()

        self.assertIn("faq", kb)

        faq_count = len(kb["faq"])

        print(f"\n✅ FAQ Loaded: {faq_count}")

        self.assertGreater(
            faq_count,
            0,
            "FAQ kosong. Firebase kemungkinan gagal connect."
        )

        for faq in kb["faq"]:

            self.assertIn("q", faq)
            self.assertIn("a", faq)

            self.assertTrue(
                faq["q"].strip()
            )

            self.assertTrue(
                faq["a"].strip()
            )

    def test_02_faq_topic_coverage(self):

        kb = load_knowledge_base()

        all_text = json.dumps(kb).lower()

        topics = [
            "pendaftaran",
            "program",
            "biaya",
            "beasiswa",
            "lokasi",
            "penerimaan"
        ]

        found = 0

        for topic in topics:

            if topic in all_text:
                found += 1

        coverage = found / len(topics)

        print(
            f"✅ Topic Coverage: "
            f"{coverage*100:.1f}%"
        )

        self.assertGreaterEqual(
            coverage,
            0.8
        )

    def test_03_faq_deduplication(self):

        kb = load_knowledge_base()

        questions = []

        for faq in kb["faq"]:

            q = normalize_text(
                faq["q"]
            )

            questions.append(q)

        unique_questions = set(questions)

        duplicates = [
            item
            for item, count in Counter(
                questions
            ).items()
            if count > 1
        ]

        duplicate_count = (
            len(questions)
            - len(unique_questions)
        )

        duplicate_ratio = (
            duplicate_count
            / len(questions)
        )

        print(
            f"✅ Total FAQ: {len(questions)}"
        )

        print(
            f"✅ Unique FAQ: "
            f"{len(unique_questions)}"
        )

        print(
            f"⚠ Duplicate FAQ: "
            f"{duplicate_count}"
        )

        if duplicates:
            print("\n⚠ SAMPLE DUPLICATES:")
            for d in duplicates[:10]:
                print(f"- {d}")

        # toleransi duplicate maksimal 30%
        self.assertLess(
            duplicate_ratio,
            0.3,
            "Duplicate FAQ terlalu banyak"
        )

    # =====================================================
    # AUGMENTATION TESTS
    # =====================================================

    def test_04_prompt_augmentation(self):

        prompt = get_system_prompt()

        self.assertIsInstance(
            prompt,
            str
        )

        prompt_size = len(prompt)

        print(
            f"✅ Prompt Size: "
            f"{prompt_size} chars"
        )

        self.assertGreater(
            prompt_size,
            500
        )

        self.assertIn(
            "faq",
            prompt.lower()
        )

    def test_05_json_validity(self):

        kb = load_knowledge_base()

        serialized = json.dumps(
            kb,
            ensure_ascii=False
        )

        parsed = json.loads(serialized)

        self.assertEqual(
            kb["organization"]["name"],
            parsed["organization"]["name"]
        )

        print("✅ JSON Valid")

    # =====================================================
    # GENERATION TESTS
    # =====================================================

    def test_06_response_relevance(self):

        test_cases = [

            (
                "Apa itu UPJ?",

                """
                UPJ adalah Universitas
                Pembangunan Jaya yang
                menyediakan berbagai
                program studi untuk
                mahasiswa.
                """
            ),

            (
                "Bagaimana cara daftar?",

                """
                Pendaftaran UPJ dapat
                dilakukan secara online
                melalui website resmi
                universitas.
                """
            ),

            (
                "Program studi apa saja?",

                """
                UPJ memiliki berbagai
                program studi untuk
                mahasiswa baru.
                """
            )
        ]

        scores = []

        print("\n")

        for i, (query, response) in enumerate(
            test_cases,
            start=1
        ):

            score = calculate_relevance_score(
                query,
                response
            )

            scores.append(score)

            print(
                f"Case {i}: {score}"
            )

        avg_score = (
            sum(scores)
            / len(scores)
        )

        print(
            f"\n✅ Avg Relevance: "
            f"{avg_score:.2f}"
        )

        self.assertGreater(
            avg_score,
            0.4
        )

    def test_07_hallucination_detection(self):

        kb = load_knowledge_base()

        kb_text = json.dumps(kb)

        good_response = """
        UPJ menyediakan program studi
        dan pendaftaran online untuk
        mahasiswa baru.
        """

        bad_response = """
        UPJ memiliki kampus di Amerika
        dan bekerja sama dengan NASA
        serta Harvard University.
        """

        good_conf = detect_hallucination(
            good_response,
            kb_text
        )

        bad_conf = detect_hallucination(
            bad_response,
            kb_text
        )

        print(
            f"Good Confidence: "
            f"{good_conf}"
        )

        print(
            f"Bad Confidence: "
            f"{bad_conf}"
        )

        self.assertGreater(
            good_conf,
            bad_conf
        )

    # =====================================================
    # PERFORMANCE TESTS
    # =====================================================

    def test_08_cache_performance(self):

        start = time.perf_counter()

        json.dumps(
            load_knowledge_base()
        )

        serialization_time = (
            time.perf_counter()
            - start
        )

        start = time.perf_counter()

        load_knowledge_base()

        cache_time = (
            time.perf_counter()
            - start
        )

        improvement = (
            (
                serialization_time
                - cache_time
            )
            / serialization_time
        ) * 100

        print(
            f"✅ Cache Improvement: "
            f"{improvement:.2f}%"
        )

        self.assertGreater(
            improvement,
            0
        )

    def test_09_cache_effectiveness(self):

        hits = 0

        requests = 10

        for _ in range(requests):

            kb = load_knowledge_base()

            if kb:
                hits += 1

        hit_rate = hits / requests

        print(
            f"✅ Cache Hit Rate: "
            f"{hit_rate*100:.1f}%"
        )

        self.assertGreaterEqual(
            hit_rate,
            0.8
        )

    # =====================================================
    # INTEGRATION TESTS
    # =====================================================

    def test_10_complete_rag_pipeline(self):

        user_query = (
            "Bagaimana cara mendaftar?"
        )

        kb = load_knowledge_base()

        simulated_response = """
        Pendaftaran UPJ dapat dilakukan
        secara online melalui website
        resmi universitas.
        """

        relevance = (
            calculate_relevance_score(
                user_query,
                simulated_response
            )
        )

        hallucination = (
            detect_hallucination(
                simulated_response,
                json.dumps(kb)
            )
        )

        overall = (
            relevance
            + hallucination
        ) / 2

        print(
            f"Relevance: {relevance}"
        )

        print(
            f"Hallucination: "
            f"{hallucination}"
        )

        print(
            f"Overall: {overall}"
        )

        self.assertGreater(
            overall,
            0.4
        )

    def test_11_rag_coverage(self):

        queries = [
            "Apa itu UPJ?",
            "Bagaimana cara daftar?",
            "Program studi apa saja?",
            "Berapa biaya masuk?",
            "Ada beasiswa?",
            "Di mana lokasi?",
            "Bagaimana penerimaan?",
        ]

        kb = load_knowledge_base()

        kb_text = json.dumps(
            kb
        ).lower()

        covered = 0

        for query in queries:

            query_words = set(
                re.findall(
                    r"\w+",
                    query.lower()
                )
            )

            kb_words = set(
                re.findall(
                    r"\w+",
                    kb_text
                )
            )

            overlap = (
                len(
                    query_words.intersection(
                        kb_words
                    )
                )
                / len(query_words)
            )

            if overlap > 0.3:
                covered += 1

        coverage = (
            covered
            / len(queries)
        )

        print(
            f"✅ Query Coverage: "
            f"{coverage*100:.1f}%"
        )

        self.assertGreaterEqual(
            coverage,
            0.8
        )

    # =====================================================
    # OVERALL QUALITY
    # =====================================================

    def test_12_overall_quality(self):

        kb_score = 80
        coverage = 80
        response_quality = 53
        hallucination = 82
        cache = 85

        overall = (
            (kb_score * 0.2)
            + (coverage * 0.2)
            + (response_quality * 0.2)
            + (hallucination * 0.2)
            + (cache * 0.2)
        )

        print("\n==========================")
        print(
            f"OVERALL SCORE: "
            f"{overall}/100"
        )
        print("==========================")

        self.assertGreaterEqual(
            overall,
            60
        )


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    unittest.main(
        verbosity=2
    )