<nav id="mobile-navigation">
   <ul class="mobile-nav mr-auto">
        <li class="nav-item">
            <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#about">About</a>
        </li><!-- /.nav-item -->
        <li class="nav-item dropdown">
            <a href="<?php if(!is_front_page()) echo esc_url( home_url( '/' ) );?>#features" class="dropdown-toggle" data-toggle="dropdown">Sector solutions</a>
            <ul>
                <li>
                    <a href="#banking" class="dropdown-item">Banking</a>
                </li>
                <li>
                    <a href="#insurance" class="dropdown-item">Insurance</a>
                </li>
                <li>
                    <a href="#landing" class="dropdown-item">Lending</a>
                </li>
                <li>
                    <a href="#debt" class="dropdown-item">Debt</a>
                </li>
            </ul>
        </li><!-- /.dropdown -->

        <?php if(get_field( 'show_switcher', 'options' )): ?>

            <li class="nav-item dropdown">
                <a href="#dropdown" class="dropdown-toggle" data-toggle="dropdown"><?php the_field( 'dropdown_label', 'options' ); ?></a>

                <?php if ( have_rows( 'language', 'options' ) ) : ?>

                    <ul>

                         <?php while ( have_rows( 'language', 'options' ) ) : the_row(); ?>
                            <?php $flag = get_sub_field( 'flag' ); ?>

                            <li>
                                <a href="<?php the_sub_field( 'url' ); ?>" class="dropdown-item"><img src="<?= $flag['url']; ?>" alt="<?= $flag['alt']; ?>" class="icon-flag d-inline-block" /> <?php the_sub_field( 'name' ); ?></a>
                            </li>

                        <?php endwhile; ?>
                    </ul>

                <?php endif; ?>

            </li><!-- /.dropdown -->

        <?php endif; ?>

    </ul><!-- /.mobile-nav mr-auto -->
</nav><!-- /#mobile-navigation -->