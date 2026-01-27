#!/usr/bin/env python3
"""
Generate boilerplate Retend components with proper imports and structure.
"""

import sys
import os


COMPONENT_TEMPLATE = '''import {{ Cell }} from 'retend';

function {component_name}() {{
  // Add reactive state here
  const exampleState = Cell.source('');
  
  return (
    <div>
      <h1>{component_name}</h1>
      {{/* Component content here */}}
    </div>
  );
}}

export default {component_name};
'''

COMPONENT_WITH_PROPS_TEMPLATE = '''
interface {component_name}Props {{
  // Define props here
}}

function {component_name}(props: {component_name}Props) {{
  // Add reactive state here
  const exampleState = Cell.source('');
  
  return (
    <div>
      <h1>{component_name}</h1>
      {{/* Component content here */}}
    </div>
  );
}}

export default {component_name};
'''

COMPONENT_WITH_ROUTING_TEMPLATE = '''import {{ Cell }} from 'retend';
import {{ useParams, useQuery }} from 'retend/router';

function {component_name}() {{
  const params = useParams();
  const query = useQuery();
  
  // Access route params
  // const id = Cell.derived(() => params.get().id);
  
  return (
    <div>
      <h1>{component_name}</h1>
      {{/* Component content here */}}
    </div>
  );
}}

export default {component_name};
'''


def create_component(name: str, template_type: str = 'basic', output_dir: str = '.'):
    """
    Create a Retend component file.
    
    Args:
        name: Component name (PascalCase)
        template_type: Type of template ('basic', 'props', 'routing')
        output_dir: Directory to create the component in
    """
    if not name:
        print("Error: Component name is required")
        sys.exit(1)
    
    # Ensure PascalCase
    component_name = ''.join(word.capitalize() for word in name.replace('-', ' ').replace('_', ' ').split())
    
    # Select template
    templates = {
        'basic': COMPONENT_TEMPLATE,
        'props': COMPONENT_WITH_PROPS_TEMPLATE,
        'routing': COMPONENT_WITH_ROUTING_TEMPLATE,
    }
    
    template = templates.get(template_type, COMPONENT_TEMPLATE)
    
    # Generate content
    content = template.format(component_name=component_name)
    
    # Create file
    filename = f"{component_name}.tsx"
    filepath = os.path.join(output_dir, filename)
    
    if os.path.exists(filepath):
        overwrite = input(f"{filepath} already exists. Overwrite? (y/n): ")
        if overwrite.lower() != 'y':
            print("Aborted.")
            sys.exit(0)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"✅ Created {filepath}")
    print(f"   Component: {component_name}")
    print(f"   Template: {template_type}")


def main():
    """Main CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate Retend component boilerplate',
        epilog='Example: python create_component.py UserProfile --type routing'
    )
    parser.add_argument('name', help='Component name (e.g., UserProfile)')
    parser.add_argument(
        '--type',
        choices=['basic', 'props', 'routing'],
        default='basic',
        help='Template type (default: basic)'
    )
    parser.add_argument(
        '--output',
        default='.',
        help='Output directory (default: current directory)'
    )
    
    args = parser.parse_args()
    
    create_component(args.name, args.type, args.output)


if __name__ == '__main__':
    main()
