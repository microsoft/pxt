#!/usr/bin/env python3

import ast

name_map = {
  "Expr": "ExprStmt",
  "arg": "Arg",
  "arguments": "Arguments",
  "keyword": "Keyword",
  "comprehension": "Comprehension",
  "alias": "Alias",
  "withitem": "WithItem"
}

def to_json(val):
    if val is None or isinstance(val, (bool, str, int, float)):
        return val
    if isinstance(val, list):
        return [to_json(x) for x in val]
    if isinstance(val, (
        ast.Load, ast.Store, ast.Del, ast.AugLoad, ast.AugStore, ast.Param, ast.And, ast.Or, ast.Add,
        ast.Sub, ast.Mult, ast.MatMult, ast.Div, ast.Mod, ast.Pow, ast.LShift, ast.RShift, ast.BitOr,
        ast.BitXor, ast.BitAnd, ast.FloorDiv, ast.Invert, ast.Not, ast.UAdd, ast.USub, ast.Eq, ast.NotEq,
        ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Is, ast.IsNot, ast.In, ast.NotIn)):
        return val.__class__.__name__
    if isinstance(val, ast.AST):
        js = dict()
        k = val.__class__.__name__
        if k in name_map:
            k = name_map[k]
        js['kind'] = k
        for attr_name in dir(val):
            if not attr_name.startswith("_") and attr_name != "col_offset":
                js[attr_name] = to_json(getattr(val, attr_name))
        return js    
    if isinstance(val, (bytearray, bytes)):
        return [x for x in val]
    raise Exception("unhandled: %s (type %s)" % (val, type(val)))


if __name__ == '__main__':
    import sys
    import json
    print(json.dumps(to_json(ast.parse(open(sys.argv[1], "r").read())), indent=2))

