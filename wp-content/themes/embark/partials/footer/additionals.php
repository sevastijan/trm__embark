<nav id="mobile-navigation">
    <div id="subpanel" class="panel">

        <?php
            wp_nav_menu([
                'menu'            => 'Main Navigation',
                'theme_location'  => 'main_navigation',
                'container'       => false,
                'menu_id'         => false,
                'menu_class'      => 'mobile-nav mr-auto',
                'walker'          => new bs4navwalker()
            ]);
        ?>

         <ul class="mobile-nav mr-auto">

            <?php if(get_field( 'show_switcher', 'options' )): ?>

                <li class="nav-item dropdown">
                    <a href="#dropdown" class="dropdown-toggle" data-toggle="dropdown">Language</a>

                    <?php if ( have_rows( 'language', 'options' ) ) : ?>

                        <ul>

                             <?php while ( have_rows( 'language', 'options' ) ) : the_row(); ?>

                                <li>
                                    <a href="<?php the_sub_field( 'url' ); ?>" class="dropdown-item"><?php the_sub_field( 'name' ); ?></a>
                                </li>

                            <?php endwhile; ?>
                        </ul>

                    <?php endif; ?>

                </li><!-- /.dropdown -->

            <?php endif; ?>

        </ul><!-- /.mobile-nav mr-auto -->
    </div><!-- /#subpanel.panel -->
</nav><!-- /#mobile-navigation -->