#!/usr/bin/env python3
"""
Validate Retend router configuration for common issues.
"""

import sys
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple


class RouteValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.routes = set()
        self.route_names = set()
    
    def validate_file(self, filepath: str) -> Tuple[List[str], List[str]]:
        """
        Validate a file containing Router.setup() or RouteRecords.
        
        Returns:
            Tuple of (errors, warnings)
        """
        try:
            with open(filepath, 'r') as f:
                content = f.read()
        except FileNotFoundError:
            return ([f"File not found: {filepath}"], [])
        
        # Check for Router.setup
        self._check_router_setup(content)
        
        # Check for RouteRecords
        self._check_route_records(content)
        
        # Validate routes
        self._validate_routes()
        
        return (self.errors, self.warnings)
    
    def _check_router_setup(self, content: str):
        """Check Router.setup() configuration."""
        # Find Router.setup calls
        setup_pattern = r'Router\.setup\(\{([^}]+)\}\)'
        matches = re.finditer(setup_pattern, content, re.MULTILINE | re.DOTALL)
        
        for match in matches:
            routes_block = match.group(1)
            # Extract route definitions
            route_pattern = r"['\"]([^'\"]+)['\"]\s*:\s*\(\s*\)\s*=>\s*import\(['\"]([^'\"]+)['\"]\)"
            
            for route_match in re.finditer(route_pattern, routes_block):
                path = route_match.group(1)
                import_path = route_match.group(2)
                
                self._add_route(path)
                self._check_import_path(import_path)
    
    def _check_route_records(self, content: str):
        """Check RouteRecords array configuration."""
        # Find route object definitions
        route_pattern = r'\{\s*name:\s*[\'"]([^\'"]*)[\'"]\s*,\s*path:\s*[\'"]([^\'"]*)[\'"]\s*,\s*component:\s*([^\s,}]+)'
        
        for match in re.finditer(route_pattern, content):
            name = match.group(1)
            path = match.group(2)
            component = match.group(3)
            
            if name:
                if name in self.route_names:
                    self.errors.append(f"Duplicate route name: '{name}'")
                self.route_names.add(name)
            else:
                self.warnings.append(f"Route '{path}' has no name (recommended for debugging)")
            
            self._add_route(path)
    
    def _add_route(self, path: str):
        """Add a route and check for duplicates."""
        if path in self.routes:
            self.errors.append(f"Duplicate route path: '{path}'")
        self.routes.add(path)
        
        # Check path format
        if not path.startswith('/') and path != '*':
            self.warnings.append(f"Route path should start with '/': '{path}'")
        
        # Check for dynamic segments
        if ':' in path:
            segments = path.split('/')
            for segment in segments:
                if segment.startswith(':'):
                    param_name = segment[1:]
                    if not param_name.isidentifier():
                        self.warnings.append(
                            f"Parameter name '{param_name}' in path '{path}' "
                            "should be a valid JavaScript identifier"
                        )
    
    def _check_import_path(self, import_path: str):
        """Check if import path looks valid."""
        # Check for common mistakes
        if not import_path.startswith('.'):
            self.warnings.append(
                f"Import path '{import_path}' should be relative (start with './' or '../')"
            )
        
        # Check file extension
        if not (import_path.endswith('.tsx') or import_path.endswith('.jsx') or 
                import_path.endswith('.ts') or import_path.endswith('.js')):
            self.warnings.append(
                f"Import path '{import_path}' should include file extension"
            )
    
    def _validate_routes(self):
        """Validate collected routes."""
        # Check for wildcard placement
        routes_list = list(self.routes)
        if '*' in routes_list and routes_list.index('*') != len(routes_list) - 1:
            self.warnings.append(
                "Wildcard route '*' should be the last route for proper fallback behavior"
            )
        
        # Check if there's a root route
        if '/' not in self.routes and routes_list:
            self.warnings.append("No root route '/' found - consider adding one")
        
        # Check for missing 404 route
        if '*' not in self.routes and routes_list:
            self.warnings.append(
                "No wildcard route '*' found - consider adding a 404 page"
            )


def main():
    """Main CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Validate Retend router configuration',
        epilog='Example: python validate_routing.py src/router.ts'
    )
    parser.add_argument('file', help='File containing router configuration')
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Treat warnings as errors'
    )
    
    args = parser.parse_args()
    
    validator = RouteValidator()
    errors, warnings = validator.validate_file(args.file)
    
    # Print results
    print(f"\n🔍 Validating: {args.file}\n")
    
    if errors:
        print("❌ ERRORS:")
        for error in errors:
            print(f"   - {error}")
        print()
    
    if warnings:
        icon = "⚠️  WARNINGS:" if not args.strict else "❌ WARNINGS (--strict):"
        print(icon)
        for warning in warnings:
            print(f"   - {warning}")
        print()
    
    if not errors and not warnings:
        print("✅ No issues found!\n")
        sys.exit(0)
    
    # Exit code
    if errors or (args.strict and warnings):
        print(f"❌ Validation failed\n")
        sys.exit(1)
    else:
        print(f"✅ Validation passed (with warnings)\n")
        sys.exit(0)


if __name__ == '__main__':
    main()
