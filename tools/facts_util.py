"""Shared helpers: load data/facts.json (single source of truth) and mirror the
spreadsheet formulas in Python so the scripts can check themselves."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FACTS_PATH = ROOT / "data" / "facts.json"
OUT_DIR = ROOT / "predare"


def load_facts():
    with open(FACTS_PATH, encoding="utf-8") as f:
        return json.load(f)


def roundup(x):
    """Excel ROUNDUP(x, 0) for positive x (tiny tolerance against float noise)."""
    return math.ceil(x - 1e-9)


def split_integer(total, weights):
    """Split an integer total by weights with the largest-remainder method."""
    s = sum(weights)
    raw = [total * w / s for w in weights]
    base = [math.floor(r) for r in raw]
    rest = total - sum(base)
    order = sorted(range(len(raw)), key=lambda i: raw[i] - base[i], reverse=True)
    for i in order[:rest]:
        base[i] += 1
    return base


def budget_eur(facts, bid):
    return next(b["eur"] for b in facts["budget"] if b["id"] == bid)


def mirror(facts, cells=None, other_costs=0.0, tax=None, rate_mult=1.0):
    """Python mirror of the workbook formulas."""
    fin, fun = facts["finance"], facts["funnel"]
    tax = fin["taxRate"] if tax is None else tax
    budget = sum(b["eur"] for b in facts["budget"])
    contribution = fin["price"] - fin["directCost"]
    cells = fin["plannedCells"] if cells is None else cells

    before_tax_cells = roundup((fin["targetNetProfit"] + budget + other_costs) / contribution)
    after_tax_cells = roundup((fin["targetNetProfit"] / (1 - tax) + budget + other_costs) / contribution)

    r_req_meet = min(1, fun["requestToMeeting"] * rate_mult)
    r_meet_off = min(1, fun["meetingToOffer"] * rate_mult)
    r_off_ord = min(1, fun["offerToOrder"] * rate_mult)
    clients = roundup(cells / fun["cellsPerClient"])
    offers = roundup(clients / r_off_ord)
    meetings = roundup(offers / r_meet_off)
    requests = roundup(meetings / r_req_meet)

    result_after_promo = cells * contribution - budget
    before_tax = result_after_promo - other_costs
    tax_amount = max(0.0, before_tax) * tax
    net = before_tax - tax_amount
    return {
        "budget": budget,
        "contribution": contribution,
        "cellsBeforeTax": before_tax_cells,
        "cellsAfterTax": after_tax_cells,
        "cells": cells,
        "revenue": cells * fin["price"],
        "directCost": cells * fin["directCost"],
        "resultAfterPromo": result_after_promo,
        "net": net,
        "promoPerCell": budget / cells,
        "headroomOtherCosts": result_after_promo - fin["targetNetProfit"] / (1 - tax),
        "clients": clients,
        "offers": offers,
        "meetings": meetings,
        "requests": requests,
        "costPerRequest": budget / requests,
        "costPerClient": budget / clients,
    }
